'use client'

import { useState, useEffect } from 'react'
import { ChevronRight, Download, Globe, Map, BarChart3, Clock, List } from 'lucide-react'
import { RegionTree } from '@/types'
import { api } from '@/lib/api'
import LoadingSpinner from '@/components/LoadingSpinner'
import RegionCard from '@/components/RegionCard'
import RegionMap from '@/components/RegionMap'

interface BreadcrumbItem {
    id: string
    name: string
}

export default function HomePage() {
    const [regions, setRegions] = useState<RegionTree[]>([])
    const [currentPath, setCurrentPath] = useState<BreadcrumbItem[]>([])
    const [selectedRegion, setSelectedRegion] = useState<RegionTree | null>(null)
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)
    const [viewMode, setViewMode] = useState<'hierarchy' | 'map'>('hierarchy')

    useEffect(() => {
        loadRegions()
        loadStats()
    }, [])

    const loadRegions = async () => {
        try {
            setLoading(true)
            const data = await api.getRegions()
            console.log('Loaded regions data:', data)
            setRegions(data)

            // Initialize with world view - try to find the top-level region
            let worldRegion = data.find(r => r.region.id === 'world')

            // If no 'world' region, try to find admin_level 0 region
            if (!worldRegion) {
                worldRegion = data.find(r => r.region.admin_level === 0)
            }

            // If still no world region, use the first region with children
            if (!worldRegion) {
                worldRegion = data.find(r => r.children && r.children.length > 0)
            }

            // If still nothing, just use the first region
            if (!worldRegion && data.length > 0) {
                worldRegion = data[0]
            }

            if (worldRegion) {
                console.log('Selected world region:', worldRegion)
                setCurrentPath([{ id: worldRegion.region.id, name: worldRegion.region.name }])
                setSelectedRegion(worldRegion)
            } else {
                console.log('No suitable world region found, showing all regions')
                // If no world region, show all top-level regions
                setCurrentPath([{ id: 'all', name: 'All Regions' }])
                setSelectedRegion(null)
            }
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

    const handleRegionSelect = (region: RegionTree) => {
        setSelectedRegion(region)

        // Update breadcrumb
        if (region.region.admin_level === "World") {
            setCurrentPath([{ id: region.region.id, name: region.region.name }])
        } else if (region.region.admin_level === "Continent") {
            setCurrentPath([
                { id: 'world', name: 'World' },
                { id: region.region.id, name: region.region.name }
            ])
        } else if (region.region.admin_level === "Country") {
            const continent = regions.find(r =>
                r.children.some(child => child.region.id === region.region.id)
            )
            setCurrentPath([
                { id: 'world', name: 'World' },
                ...(continent ? [{ id: continent.region.id, name: continent.region.name }] : []),
                { id: region.region.id, name: region.region.name }
            ])
        }
    }

    const handleBreadcrumbClick = (breadcrumbId: string) => {
        const region = findRegionById(regions, breadcrumbId)
        if (region) {
            handleRegionSelect(region)
        }
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

    const getCurrentRegions = () => {
        if (!selectedRegion) {
            // If no selected region, show all top-level regions
            return regions
        }

        if (selectedRegion.region.admin_level === "World") {
            return selectedRegion.children // Show continents
        } else if (selectedRegion.region.admin_level === "Continent") {
            return selectedRegion.children // Show countries
        } else if (selectedRegion.region.admin_level === "Country") {
            return selectedRegion.children // Show regions/states
        }

        return []
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
            {/* Header */}
            <header className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-6">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                                <Globe className="h-8 w-8 text-blue-600" />
                                RieMap
                            </h1>
                            <p className="text-gray-600 mt-1">OpenStreetMap Data Portal</p>
                        </div>

                        {stats && (
                            <div className="flex items-center gap-6 text-sm text-gray-600">
                                <div className="flex items-center gap-2">
                                    <Map className="h-4 w-4" />
                                    <span>{stats.total_regions} regions</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <BarChart3 className="h-4 w-4" />
                                    <span>{Math.round(stats.total_area_km2?.toLocaleString() || 0)} km²</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4" />
                                    <span>Updated daily</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Breadcrumb */}
            <div className="bg-white border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <nav className="flex items-center space-x-2 text-sm">
                        {currentPath.map((item, index) => (
                            <div key={item.id} className="flex items-center">
                                {index > 0 && <ChevronRight className="h-4 w-4 text-gray-400 mx-2" />}
                                <button
                                    onClick={() => handleBreadcrumbClick(item.id)}
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
                        {selectedRegion ? selectedRegion.region.name : 'World'}
                    </h2>
                    <div className="flex bg-gray-100 rounded-lg p-1">
                        <button
                            onClick={() => setViewMode('hierarchy')}
                            className={`px-4 py-2 rounded-md flex items-center gap-2 transition-colors ${viewMode === 'hierarchy'
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

                {/* Map View */}
                {viewMode === 'map' && (
                    <div className="bg-white rounded-lg shadow-sm mb-8">
                        <RegionMap
                            regions={regions}
                            selectedRegion={selectedRegion}
                            onRegionSelect={handleRegionSelect}
                            className="h-96 rounded-lg"
                        />
                    </div>
                )}

                {/* Current Region Info */}
                {selectedRegion && (
                    <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
                        <div className="flex items-start justify-between">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">
                                    {selectedRegion.region.name}
                                </h2>
                                <p className="text-gray-600 mt-1">
                                    Administrative Level: {selectedRegion.region.admin_level}
                                </p>
                                <div className="flex items-center gap-6 mt-4 text-sm text-gray-600">
                                    {selectedRegion.region.area_km2 && (
                                        <span>Area: {selectedRegion.region.area_km2.toLocaleString()} km²</span>
                                    )}
                                    {selectedRegion.region.population && (
                                        <span>Population: {selectedRegion.region.population.toLocaleString()}</span>
                                    )}
                                    <span>
                                        {selectedRegion.children.length} sub-regions
                                    </span>
                                    <span>
                                        {selectedRegion.data_files.length} data files
                                    </span>
                                </div>
                            </div>

                            {selectedRegion.data_files.length > 0 && (
                                <div className="flex flex-col gap-2">
                                    {selectedRegion.data_files.slice(0, 2).map((file) => (
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
                    </div>
                )}

                {/* Sub-regions Grid */}
                {currentRegions.length > 0 && (
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-6">
                            {selectedRegion?.region.admin_level === "World" && 'Continents'}
                            {selectedRegion?.region.admin_level === "Continent" && 'Countries'}
                            {selectedRegion?.region.admin_level === "Country" && 'Regions'}
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {currentRegions.map((region) => (
                                <RegionCard
                                    key={region.region.id}
                                    region={region}
                                    isSelected={selectedRegion?.region.id === region.region.id}
                                    onSelect={() => handleRegionSelect(region)}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {currentRegions.length === 0 && selectedRegion && (
                    <div className="text-center py-12">
                        <Map className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                            No sub-regions available
                        </h3>
                        <p className="text-gray-600">
                            This region doesn't have any sub-regions to explore.
                        </p>
                        {selectedRegion.data_files.length > 0 && (
                            <p className="text-gray-600 mt-2">
                                But you can download the data files above.
                            </p>
                        )}
                    </div>
                )}
            </main>
        </div>
    )
} 