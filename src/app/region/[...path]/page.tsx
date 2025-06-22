'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronRight, Download, Map, BarChart3, Clock, List, GitCompare, ArrowLeft } from 'lucide-react'
import { RegionTree } from '@/types'
import { api } from '@/lib/api'
import LoadingSpinner from '@/components/LoadingSpinner'
import RegionCard from '@/components/RegionCard'
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
    const path = Array.isArray(params.path) ? params.path : [params.path].filter(Boolean)

    const [regions, setRegions] = useState<RegionTree[]>([])
    const [currentRegion, setCurrentRegion] = useState<RegionTree | null>(null)
    const [currentPath, setCurrentPath] = useState<BreadcrumbItem[]>([])
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)
    const [viewMode, setViewMode] = useState<'list' | 'map'>('list')
    const [qualityReportModal, setQualityReportModal] = useState<{
        isOpen: boolean
        regionId: string
        regionName: string
    }>({ isOpen: false, regionId: '', regionName: '' })
    const [versionComparisonModal, setVersionComparisonModal] = useState<{
        isOpen: boolean
        regionId: string
        regionName: string
        files: any[]
    }>({ isOpen: false, regionId: '', regionName: '', files: [] })

    useEffect(() => {
        loadRegions()
        loadStats()
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

    const loadStats = async () => {
        try {
            const statsData = await api.getStats()
            setStats(statsData)
        } catch (err) {
            console.error('Error loading stats:', err)
        }
    }

    const navigateToPath = (urlPath: string[]) => {
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
        const region = findRegionById(regions, targetRegionId)

        if (region) {
            setCurrentRegion(region)
            // Build breadcrumb path
            const breadcrumb = buildBreadcrumbFromPath(urlPath)
            setCurrentPath(breadcrumb)
        } else {
            // Region not found, redirect to home
            console.error('Region not found:', targetRegionId)
            router.push('/')
        }
    }

    const buildBreadcrumbFromPath = (urlPath: string[]): BreadcrumbItem[] => {
        const breadcrumb: BreadcrumbItem[] = []

        for (let i = 0; i < urlPath.length; i++) {
            const regionId = urlPath[i]
            const region = findRegionById(regions, regionId)
            if (region) {
                breadcrumb.push({
                    id: region.region.id,
                    name: region.region.name,
                    path: `/region/${urlPath.slice(0, i + 1).join('/')}`
                })
            }
        }

        return breadcrumb
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

        // Build the URL path based on region hierarchy
        const urlPath = buildRegionPath(region)
        const newUrl = `/region/${urlPath.join('/')}`

        // Navigate to the new URL
        router.push(newUrl)
    }

    const buildRegionPath = (targetRegion: RegionTree): string[] => {
        const path: string[] = []

        // Find the hierarchical path to this region
        const findPath = (currentRegions: RegionTree[], target: RegionTree, currentPath: string[]): boolean => {
            for (const region of currentRegions) {
                const newPath = [...currentPath, region.region.id]

                if (region.region.id === target.region.id) {
                    path.push(...newPath)
                    return true
                }

                if (findPath(region.children, target, newPath)) {
                    return true
                }
            }
            return false
        }

        findPath(regions, targetRegion, [])
        return path
    }

    const handleBreadcrumbClick = (breadcrumbPath: string) => {
        router.push(breadcrumbPath)
    }

    const handleDownload = async (regionId: string, version: string) => {
        try {
            const response = await fetch(`/api/download/${regionId}/${version}`)
            if (!response.ok) {
                throw new Error('Download failed')
            }

            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${regionId}-${version}.osm.pbf`
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)
        } catch (err) {
            console.error('Download failed:', err)
            alert('Download failed. Please try again.')
        }
    }

    const handleQualityReport = (regionId: string, regionName: string) => {
        setQualityReportModal({ isOpen: true, regionId, regionName })
    }

    const handleVersionCompare = (regionId: string, regionName: string, files: any[]) => {
        setVersionComparisonModal({ isOpen: true, regionId, regionName, files })
    }

    const handleBackNavigation = () => {
        if (currentPath.length > 1) {
            // Navigate to parent region
            const parentPath = currentPath[currentPath.length - 2].path
            router.push(parentPath)
        } else {
            // Navigate to home
            router.push('/')
        }
    }

    const getCurrentRegions = () => {
        if (!currentRegion) {
            return regions
        }
        return currentRegion.children
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
                        {/* Back Button */}
                        {currentPath.length > 0 && (
                            <button
                                onClick={handleBackNavigation}
                                className="flex items-center gap-2 px-3 py-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors mr-4"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Back
                            </button>
                        )}

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
                                    onClick={() => handleBreadcrumbClick(item.path)}
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
                {/* View Mode Toggle */}
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold text-gray-900">
                        {currentRegion ? currentRegion.region.name : 'World'}
                    </h2>
                    <div className="flex bg-gray-100 rounded-lg p-1">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`px-4 py-2 rounded-md flex items-center gap-2 transition-colors ${viewMode === 'list'
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            <List className="h-4 w-4" />
                            List
                        </button>
                        <button
                            onClick={() => setViewMode('map')}
                            className={`px-4 py-2 rounded-md flex items-center gap-2 transition-colors ${viewMode === 'map'
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            <Map className="h-4 w-4" />
                            Map
                        </button>
                    </div>
                </div>

                {/* List View - Compact with small map overview */}
                {viewMode === 'list' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Compact Region List */}
                        <div className="lg:col-span-2">
                            <CompactRegionList
                                regions={currentRegions}
                                selectedRegion={currentRegion}
                                onRegionSelect={handleRegionSelect}
                                onDownload={handleDownload}
                                onQualityReport={handleQualityReport}
                                onVersionCompare={handleVersionCompare}
                            />
                        </div>

                        {/* Small Map Overview */}
                        <div className="lg:col-span-1">
                            <div className="bg-white rounded-lg shadow-sm border">
                                <div className="p-4 border-b">
                                    <h3 className="font-semibold text-gray-900">Map Overview</h3>
                                    <p className="text-sm text-gray-600 mt-1">
                                        {currentRegion ? currentRegion.region.name : 'World View'}
                                    </p>
                                </div>
                                <div className="h-64">
                                    <RegionMap
                                        regions={regions}
                                        selectedRegion={currentRegion}
                                        onRegionSelect={handleRegionSelect}
                                        className="h-full rounded-b-lg"
                                    />
                                </div>
                            </div>

                            {/* Selected Region Info */}
                            {currentRegion && (
                                <div className="mt-6 bg-white rounded-lg shadow-sm border p-4">
                                    <h4 className="font-semibold text-gray-900 mb-3">Region Details</h4>
                                    <div className="space-y-3">
                                        <div>
                                            <span className="text-sm text-gray-500">Administrative Level</span>
                                            <p className="font-medium">{currentRegion.region.admin_level}</p>
                                        </div>
                                        {currentRegion.region.area_km2 && (
                                            <div>
                                                <span className="text-sm text-gray-500">Area</span>
                                                <p className="font-medium">{currentRegion.region.area_km2.toLocaleString()} km²</p>
                                            </div>
                                        )}
                                        {currentRegion.region.population && (
                                            <div>
                                                <span className="text-sm text-gray-500">Population</span>
                                                <p className="font-medium">{currentRegion.region.population.toLocaleString()}</p>
                                            </div>
                                        )}
                                        <div className="pt-3 border-t space-y-2">
                                            <button
                                                onClick={() => handleQualityReport(currentRegion.region.id, currentRegion.region.name)}
                                                className="w-full flex items-center gap-2 px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                                            >
                                                <BarChart3 className="h-4 w-4" />
                                                Quality Report
                                            </button>
                                            {currentRegion.data_files.length > 1 && (
                                                <button
                                                    onClick={() => handleVersionCompare(currentRegion.region.id, currentRegion.region.name, currentRegion.data_files)}
                                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
                                                >
                                                    <GitCompare className="h-4 w-4" />
                                                    Compare Versions
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Map View - Full screen interactive */}
                {viewMode === 'map' && (
                    <div className="space-y-6">
                        {/* Full Screen Map */}
                        <div className="bg-white rounded-lg shadow-sm">
                            <div className="p-4 border-b">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-semibold text-gray-900">Interactive Map</h3>
                                    <div className="flex items-center gap-4 text-sm text-gray-600">
                                        <span>Click regions to select</span>
                                        {currentRegion && (
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleQualityReport(currentRegion.region.id, currentRegion.region.name)}
                                                    className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors"
                                                >
                                                    <BarChart3 className="h-3 w-3" />
                                                    Quality
                                                </button>
                                                {currentRegion.data_files.length > 1 && (
                                                    <button
                                                        onClick={() => handleVersionCompare(currentRegion.region.id, currentRegion.region.name, currentRegion.data_files)}
                                                        className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full hover:bg-green-200 transition-colors"
                                                    >
                                                        <GitCompare className="h-3 w-3" />
                                                        Compare
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="h-96">
                                <RegionMap
                                    regions={regions}
                                    selectedRegion={currentRegion}
                                    onRegionSelect={handleRegionSelect}
                                    className="h-full rounded-b-lg"
                                />
                            </div>
                        </div>

                        {/* Selected Region Details */}
                        {currentRegion && (
                            <div className="bg-white rounded-lg shadow-sm p-6">
                                <div className="flex items-start justify-between mb-6">
                                    <div>
                                        <h2 className="text-2xl font-bold text-gray-900">
                                            {currentRegion.region.name}
                                        </h2>
                                        <p className="text-gray-600 mt-1">
                                            Administrative Level: {currentRegion.region.admin_level}
                                        </p>
                                        <div className="flex items-center gap-6 mt-4 text-sm text-gray-600">
                                            {currentRegion.region.area_km2 && (
                                                <span>Area: {currentRegion.region.area_km2.toLocaleString()} km²</span>
                                            )}
                                            {currentRegion.region.population && (
                                                <span>Population: {currentRegion.region.population.toLocaleString()}</span>
                                            )}
                                            <span>{currentRegion.children.length} sub-regions</span>
                                            <span>{currentRegion.data_files.length} data files</span>
                                        </div>
                                    </div>

                                    {currentRegion.data_files.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {currentRegion.data_files.slice(0, 2).map((file) => (
                                                <button
                                                    key={file.id}
                                                    onClick={() => handleDownload(file.region_id, file.version)}
                                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                                >
                                                    <Download className="h-4 w-4" />
                                                    <span className="text-sm">
                                                        {file.is_latest ? 'Latest' : file.version}
                                                        {' '}({(file.file_size / 1024 / 1024).toFixed(1)} MB)
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Sub-regions Grid */}
                                {currentRegions.length > 0 && (
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
                                            {currentRegion.region.admin_level === "World" && 'Continents'}
                                            {currentRegion.region.admin_level === "Continent" && 'Countries'}
                                            {currentRegion.region.admin_level === "Country" && 'Regions'}
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {currentRegions.map((region) => (
                                                <RegionCard
                                                    key={region.region.id}
                                                    region={region}
                                                    isSelected={currentRegion?.region.id === region.region.id}
                                                    onSelect={() => handleRegionSelect(region)}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Empty State */}
                        {currentRegions.length === 0 && currentRegion && (
                            <div className="text-center py-12 bg-white rounded-lg shadow-sm">
                                <Map className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 mb-2">
                                    No sub-regions available
                                </h3>
                                <p className="text-gray-600">
                                    This region doesn't have any sub-regions to explore.
                                </p>
                                {currentRegion.data_files.length > 0 && (
                                    <p className="text-gray-600 mt-2">
                                        But you can download the data files above.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Quality Report Modal */}
            <QualityReportModal
                isOpen={qualityReportModal.isOpen}
                onClose={() => setQualityReportModal({ isOpen: false, regionId: '', regionName: '' })}
                regionId={qualityReportModal.regionId}
                regionName={qualityReportModal.regionName}
            />

            {/* Version Comparison Modal */}
            <VersionComparisonModal
                isOpen={versionComparisonModal.isOpen}
                onClose={() => setVersionComparisonModal({ isOpen: false, regionId: '', regionName: '', files: [] })}
                regionId={versionComparisonModal.regionId}
                regionName={versionComparisonModal.regionName}
                files={versionComparisonModal.files}
            />
        </div>
    )
} 