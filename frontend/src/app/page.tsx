'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Globe, Map, BarChart3, Clock, ArrowRight, MapPin } from 'lucide-react'
import { RegionTree } from '@/types'
import { api } from '@/lib/api'
import LoadingSpinner from '@/components/LoadingSpinner'

export default function HomePage() {
    const router = useRouter()
    const [stats, setStats] = useState<any>(null)
    const [regions, setRegions] = useState<RegionTree[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        loadRegions()
        loadStats()
    }, [])

    const loadRegions = async () => {
        try {
            setLoading(true)
            const data = await api.getRegions()
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

    const handleExploreWorld = () => {
        // Navigate to the root regions view (no specific region)
        // This will show all continents at the top level
        router.push('/region')
    }

    const handleQuickAccess = (regionId: string) => {
        router.push(`/region/${regionId}`)
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

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
            {/* Hero Section */}
            <div className="bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                    <div className="text-center">
                        <div className="flex justify-center mb-6">
                            <Globe className="h-16 w-16 text-blue-600" />
                        </div>
                        <h1 className="text-4xl font-bold text-gray-900 mb-4">
                            Welcome to RieMap
                        </h1>
                        <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
                            Your gateway to refined OpenStreetMap data. Explore regions worldwide,
                            access quality reports, and download the latest geographic data.
                        </p>

                        {stats && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                                <div className="text-center">
                                    <div className="flex items-center justify-center mb-2">
                                        <Map className="h-8 w-8 text-blue-600" />
                                    </div>
                                    <div className="text-3xl font-bold text-gray-900">{stats.total_regions}</div>
                                    <div className="text-gray-600">Regions Available</div>
                                </div>
                                <div className="text-center">
                                    <div className="flex items-center justify-center mb-2">
                                        <BarChart3 className="h-8 w-8 text-green-600" />
                                    </div>
                                    <div className="text-3xl font-bold text-gray-900">
                                        {Math.round(stats.total_area_km2 / 1000000)}M
                                    </div>
                                    <div className="text-gray-600">km² Coverage</div>
                                </div>
                                <div className="text-center">
                                    <div className="flex items-center justify-center mb-2">
                                        <Clock className="h-8 w-8 text-purple-600" />
                                    </div>
                                    <div className="text-3xl font-bold text-gray-900">Daily</div>
                                    <div className="text-gray-600">Updates</div>
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <button
                                onClick={handleExploreWorld}
                                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                <Globe className="h-5 w-5 mr-2" />
                                Explore World
                                <ArrowRight className="h-5 w-5 ml-2" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Access Section */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-bold text-gray-900 mb-4">Quick Access</h2>
                    <p className="text-gray-600">Jump directly to popular regions</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {regions.slice(0, 6).map((region) => (
                        <div
                            key={region.region.id}
                            className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow cursor-pointer"
                            onClick={() => handleQuickAccess(region.region.id)}
                        >
                            <div className="p-6">
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
                                                <div className="flex items-center gap-2">
                                                    <MapPin className="h-4 w-4" />
                                                    <span>{region.region.area_km2.toLocaleString()} km²</span>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-2">
                                                <Map className="h-4 w-4" />
                                                <span>{region.children.length} sub-regions</span>
                                            </div>
                                        </div>
                                    </div>
                                    <ArrowRight className="h-5 w-5 text-gray-400" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Features Section */}
            <div className="bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold text-gray-900 mb-4">Features</h2>
                        <p className="text-gray-600">Everything you need for OpenStreetMap data</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="text-center">
                            <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                                <Map className="h-8 w-8 text-blue-600" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">Interactive Maps</h3>
                            <p className="text-gray-600">
                                Explore regions with our interactive map interface and discover sub-regions easily.
                            </p>
                        </div>

                        <div className="text-center">
                            <div className="bg-green-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                                <BarChart3 className="h-8 w-8 text-green-600" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">Quality Reports</h3>
                            <p className="text-gray-600">
                                Get detailed quality assessments with completeness, accuracy, and freshness scores.
                            </p>
                        </div>

                        <div className="text-center">
                            <div className="bg-purple-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                                <Clock className="h-8 w-8 text-purple-600" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">Version History</h3>
                            <p className="text-gray-600">
                                Compare different versions of data and track changes over time.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
} 