'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronRight, Download, Map, BarChart3, List, GitCompare, ArrowLeft } from 'lucide-react'
import { RegionTree } from '@/types'
import { api } from '@/lib/api'
import LoadingSpinner from '@/components/LoadingSpinner'
import RegionMap from '@/components/RegionMap'
import CompactRegionList from '@/components/CompactRegionList'
import QualityReportModal from '@/components/QualityReportModal'
import VersionComparisonModal from '@/components/VersionComparisonModal'

interface BreadcrumbItem {
    id: string
    name: string
    path: string
}

export default function RegionPage() {
    const params = useParams()
    const router = useRouter()
    const path = Array.isArray(params.path)
        ? params.path
        : params.path
            ? [params.path]
            : []

    const [regions, setRegions] = useState<RegionTree[]>([])
    const [currentRegion, setCurrentRegion] = useState<RegionTree | null>(null)
    const [currentPath, setCurrentPath] = useState<BreadcrumbItem[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showQualityModal, setShowQualityModal] = useState(false)
    const [showVersionModal, setShowVersionModal] = useState(false)

    useEffect(() => {
        loadRegions()
    }, [])

    useEffect(() => {
        if (regions.length > 0) {
            navigateToPath(path)
        }
    }, [regions, path])

    const loadRegions = async () => {
        try {
            setLoading(true)
            const data = await api.getRegions()
            console.log('Loaded regions data:', data)
            setRegions(data)
        } catch (err) {
            setError('Failed to load regions')
            console.error('Error loading regions:', err)
        } finally {
            setLoading(false)
        }
    }

    const navigateToPath = async (urlPath: string[]) => {
        if (!urlPath || urlPath.length === 0) {
            // Root - show world or all regions
            const worldRegion = findRegionById(regions, 'world') ||
                regions.find(r => r.region.admin_level === "World") ||
                (regions.length > 0 ? regions[0] : null)
            setCurrentRegion(worldRegion)
            setCurrentPath(worldRegion ? [{
                id: worldRegion.region.id,
                name: worldRegion.region.name,
                path: `/region/${worldRegion.region.id}`
            }] : [])
            return
        }

        // Navigate to the last region in the path
        const targetRegionId = urlPath[urlPath.length - 1]
        let region = findRegionById(regions, targetRegionId)

        // If region not found in current hierarchy, fetch it directly from API
        if (!region) {
            try {
                console.log(`Region ${targetRegionId} not found in hierarchy, fetching from API...`)
                const fetchedRegion = await api.regions.get(targetRegionId)
                setCurrentRegion(fetchedRegion)
                // Build breadcrumb path
                const breadcrumb = buildBreadcrumbFromPath(urlPath)
                setCurrentPath(breadcrumb)
                return
            } catch (error) {
                console.error('Failed to fetch region from API:', error)
                // Region not found, redirect to home
                console.error('Region not found:', targetRegionId)
                router.push('/')
                return
            }
        }

        setCurrentRegion(region)
        // Build breadcrumb path
        const breadcrumb = buildBreadcrumbFromPath(urlPath)
        setCurrentPath(breadcrumb)
    }

    const buildBreadcrumbFromPath = (urlPath: string[]): BreadcrumbItem[] => {
        if (!urlPath || urlPath.length === 0) return []

        // Get the target region (last in path)
        const targetRegionId = urlPath[urlPath.length - 1]
        const targetRegion = findRegionById(regions, targetRegionId)

        if (!targetRegion) return []

        // Build the complete hierarchy from the target region back to root
        return buildCompleteHierarchy(targetRegion)
    }

    const buildCompleteHierarchy = (targetRegion: RegionTree): BreadcrumbItem[] => {
        const hierarchy: BreadcrumbItem[] = []

        // Build path from target region back to root
        const buildPath = (region: RegionTree, path: string[] = []): string[] => {
            const newPath = [region.region.id, ...path]

            if (region.region.parent_id) {
                const parent = findRegionById(regions, region.region.parent_id)
                if (parent) {
                    return buildPath(parent, newPath)
                }
            }

            return newPath
        }

        const fullPath = buildPath(targetRegion)

        // Convert to breadcrumb items
        for (let i = 0; i < fullPath.length; i++) {
            const regionId = fullPath[i]
            const region = findRegionById(regions, regionId)
            if (region) {
                hierarchy.push({
                    id: region.region.id,
                    name: region.region.name,
                    path: `/region/${fullPath.slice(0, i + 1).join('/')}`
                })
            }
        }

        return hierarchy
    }

    const findRegionById = (regionList: RegionTree[], id: string): RegionTree | null => {
        for (const region of regionList) {
            if (region.region.id === id) {
                return region
            }
            const found = findRegionById(region.children, id)
            if (found) {
                return found
            }
        }
        return null
    }

    const handleRegionSelect = (region: RegionTree) => {
        if (!region || !region.region) {
            console.error('Invalid region data:', region)
            return
        }

        // Build full hierarchical path for the region
        const fullPath = buildRegionPath(region)
        router.push(`/region/${fullPath.join('/')}`)
    }

    const buildRegionPath = (region: RegionTree): string[] => {
        const path: string[] = []

        const buildPath = (currentRegion: RegionTree): void => {
            if (currentRegion.region.parent_id) {
                const parent = findRegionById(regions, currentRegion.region.parent_id)
                if (parent) {
                    buildPath(parent)
                }
            }
            path.push(currentRegion.region.id)
        }

        buildPath(region)
        return path
    }

    const getCurrentRegions = () => {
        if (!currentRegion) {
            return regions
        }
        return currentRegion.children
    }

    const handleDownloadFile = async (regionId: string, version: string) => {
        try {
            const response = await fetch(`/api/regions/${regionId}/files/${version}/download`)
            if (response.ok) {
                const blob = await response.blob()
                const url = window.URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `${regionId}-${version}.osm.pbf`
                document.body.appendChild(a)
                a.click()
                window.URL.revokeObjectURL(url)
                document.body.removeChild(a)
            }
        } catch (error) {
            console.error('Download failed:', error)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <LoadingSpinner size="lg" />
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="text-red-500 text-xl mb-4">⚠️ Error</div>
                    <p className="text-gray-600">{error}</p>
                    <button
                        onClick={loadRegions}
                        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                        Retry
                    </button>
                </div>
            </div>
        )
    }

    const currentRegions = getCurrentRegions()

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Breadcrumb */}
            <div className="bg-white border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <nav className="flex items-center space-x-2 text-sm">
                        {/* Home Link */}
                        <button
                            onClick={() => router.push('/')}
                            className="text-gray-500 hover:text-gray-700"
                        >
                            Home
                        </button>

                        {/* Breadcrumb Path */}
                        {currentPath.map((item, index) => (
                            <div key={item.id} className="flex items-center">
                                <ChevronRight className="h-4 w-4 text-gray-400 mx-2" />
                                <button
                                    onClick={() => router.push(item.path)}
                                    className={`${index === currentPath.length - 1
                                        ? 'text-blue-600 font-medium'
                                        : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    {item.name}
                                </button>
                            </div>
                        ))}
                    </nav>
                </div>
            </div>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900">
                            {currentRegion ? currentRegion.region.name : 'World'}
                        </h2>
                        {currentRegion && (
                            <p className="text-gray-600 text-sm">
                                {currentRegion.region.admin_level}
                                {currentRegion.region.area_km2 && (
                                    <span> • {currentRegion.region.area_km2.toLocaleString()} km²</span>
                                )}
                                {currentRegion.region.population && (
                                    <span> • {currentRegion.region.population.toLocaleString()} population</span>
                                )}
                            </p>
                        )}
                    </div>

                    <div className="flex items-center gap-4">


                        {/* Action Buttons - Only show for regions that provide data services */}
                        {currentRegion && currentRegion.region.provides_data_services && (
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowQualityModal(true)}
                                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    <BarChart3 className="h-4 w-4 mr-1.5 inline" />
                                    Quality Report
                                </button>
                                {currentRegion.data_files.length > 1 && (
                                    <button
                                        onClick={() => setShowVersionModal(true)}
                                        className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                                    >
                                        <GitCompare className="h-4 w-4 mr-1.5 inline" />
                                        Compare
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Split Layout: Left side list, Right side map */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column - Content */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Sub-regions */}
                        {currentRegions.length > 0 && (
                            <div>
                                <h3 className="text-lg font-medium text-gray-900 mb-4">Sub-regions</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {currentRegions.map((region) => (
                                        <div
                                            key={region.region.id}
                                            className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow cursor-pointer"
                                            onClick={() => handleRegionSelect(region)}
                                        >
                                            <div className="p-4">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                                            {region.region.name}
                                                        </h3>
                                                        <p className="text-sm text-gray-600 mb-3">
                                                            {region.region.admin_level}
                                                        </p>

                                                        <div className="space-y-1 text-sm text-gray-500">
                                                            {region.region.area_km2 && (
                                                                <div>Area: {region.region.area_km2.toLocaleString()} km²</div>
                                                            )}
                                                            {region.region.population && (
                                                                <div>Population: {region.region.population.toLocaleString()}</div>
                                                            )}
                                                            <div>{region.children.length} sub-regions</div>
                                                            <div>{region.data_files.length} data files</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Data Files - Only show for regions that provide data services */}
                        {currentRegion && currentRegion.region.provides_data_services && currentRegion.data_files.length > 0 && (
                            <div>
                                <h3 className="text-lg font-medium text-gray-900 mb-4">Available Data Files</h3>
                                <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Version
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Format
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Size
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Created
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Actions
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {currentRegion.data_files.map((file) => (
                                                    <tr key={file.id} className="hover:bg-gray-50">
                                                        <td className="px-4 py-3 whitespace-nowrap">
                                                            <div className="flex items-center">
                                                                <span className="text-sm font-medium text-gray-900">
                                                                    {file.version}
                                                                </span>
                                                                {file.is_latest && (
                                                                    <span className="ml-2 inline-flex px-2 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded-full">
                                                                        Latest
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                            {file.format}
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                            {(file.file_size / 1024 / 1024).toFixed(1)} MB
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                            {new Date(file.created_at).toLocaleDateString()}
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    handleDownloadFile(file.region_id, file.version)
                                                                }}
                                                                className="inline-flex items-center px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                                                            >
                                                                <Download className="h-4 w-4 mr-1" />
                                                                Download
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Empty State */}
                        {currentRegions.length === 0 && (!currentRegion || (currentRegion.region.provides_data_services && currentRegion.data_files.length === 0)) && (
                            <div className="text-center py-12 bg-white rounded-lg shadow-sm">
                                <Map className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 mb-2">
                                    {currentRegion?.region.provides_data_services
                                        ? "No data available"
                                        : "Navigation level"}
                                </h3>
                                <p className="text-gray-600">
                                    {currentRegion?.region.provides_data_services
                                        ? "This region doesn't have any sub-regions or data files available."
                                        : "This level is for navigation only. Data services are available at country and regional levels."}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Right Column - Map */}
                    <div className="lg:col-span-1">
                        <div className="sticky top-6">
                            <div className="bg-white rounded-lg shadow-sm border overflow-hidden" style={{ height: '600px' }}>
                                <div className="px-4 py-3 border-b bg-gray-50">
                                    <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                                        <Map className="h-4 w-4" />
                                        Region Overview
                                    </h3>
                                </div>
                                <RegionMap
                                    regions={getCurrentRegions()}
                                    selectedRegion={currentRegion}
                                    onRegionSelect={handleRegionSelect}
                                    className="w-full h-full"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Modals - Only show for regions that provide data services */}
            {currentRegion && currentRegion.region.provides_data_services && (
                <>
                    <QualityReportModal
                        isOpen={showQualityModal}
                        onClose={() => setShowQualityModal(false)}
                        regionId={currentRegion.region.id}
                        regionName={currentRegion.region.name}
                    />
                    <VersionComparisonModal
                        isOpen={showVersionModal}
                        onClose={() => setShowVersionModal(false)}
                        regionId={currentRegion.region.id}
                        regionName={currentRegion.region.name}
                        files={currentRegion.data_files}
                    />
                </>
            )}
        </div>
    )
}
