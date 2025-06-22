'use client'

import { useState, useEffect } from 'react'
import { X, ArrowRight, Plus, Minus, GitCompare, Calendar, FileText } from 'lucide-react'
import { api } from '@/lib/api'
import { DataFile } from '@/types'

interface VersionComparison {
    region_id: string
    from_version: string
    to_version: string
    comparison_date: string
    changes: {
        added_features: number
        modified_features: number
        deleted_features: number
        total_features_from: number
        total_features_to: number
    }
    change_details: {
        category: string
        added: number
        modified: number
        deleted: number
    }[]
    file_size_change: number
    data_quality_change: number
}

interface VersionComparisonModalProps {
    isOpen: boolean
    onClose: () => void
    regionId: string
    regionName: string
    files: DataFile[]
}

export default function VersionComparisonModal({
    isOpen,
    onClose,
    regionId,
    regionName,
    files
}: VersionComparisonModalProps) {
    const [fromVersion, setFromVersion] = useState('')
    const [toVersion, setToVersion] = useState('')
    const [comparison, setComparison] = useState<VersionComparison | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const sortedFiles = files.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    useEffect(() => {
        if (isOpen && sortedFiles.length >= 2) {
            setToVersion(sortedFiles[0].version) // Latest version
            setFromVersion(sortedFiles[1].version) // Previous version
        }
    }, [isOpen, sortedFiles])

    const handleCompare = async () => {
        if (!fromVersion || !toVersion) return

        try {
            setLoading(true)
            setError(null)
            const comparisonData = await api.regions.compare(regionId, fromVersion, toVersion)
            setComparison(comparisonData as any)
        } catch (err) {
            setError('Failed to load version comparison')
            console.error('Error loading version comparison:', err)
        } finally {
            setLoading(false)
        }
    }

    const formatFileSize = (bytes: number): string => {
        const mb = bytes / (1024 * 1024)
        return mb < 1 ? `${(bytes / 1024).toFixed(1)} KB` : `${mb.toFixed(1)} MB`
    }

    const getChangeIcon = (value: number) => {
        if (value > 0) return <Plus className="h-4 w-4 text-green-600" />
        if (value < 0) return <Minus className="h-4 w-4 text-red-600" />
        return <span className="h-4 w-4" />
    }

    const getChangeColor = (value: number) => {
        if (value > 0) return 'text-green-600'
        if (value < 0) return 'text-red-600'
        return 'text-gray-600'
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                            <GitCompare className="h-5 w-5" />
                            Version Comparison
                        </h2>
                        <p className="text-gray-600">{regionName}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-6">
                    {/* Version Selection */}
                    <div className="bg-gray-50 rounded-lg p-6 mb-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Select versions to compare</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    From Version
                                </label>
                                <select
                                    value={fromVersion}
                                    onChange={(e) => setFromVersion(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="">Select version</option>
                                    {sortedFiles.map((file) => (
                                        <option key={file.id} value={file.version}>
                                            {file.version} ({new Date(file.created_at).toLocaleDateString()})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex justify-center">
                                <ArrowRight className="h-6 w-6 text-gray-400" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    To Version
                                </label>
                                <select
                                    value={toVersion}
                                    onChange={(e) => setToVersion(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="">Select version</option>
                                    {sortedFiles.map((file) => (
                                        <option key={file.id} value={file.version}>
                                            {file.version} ({new Date(file.created_at).toLocaleDateString()})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="mt-4">
                            <button
                                onClick={handleCompare}
                                disabled={!fromVersion || !toVersion || loading}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <GitCompare className="h-4 w-4" />
                                {loading ? 'Comparing...' : 'Compare Versions'}
                            </button>
                        </div>
                    </div>

                    {/* Loading State */}
                    {loading && (
                        <div className="text-center py-8">
                            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                            <p className="text-gray-600">Comparing versions...</p>
                        </div>
                    )}

                    {/* Error State */}
                    {error && (
                        <div className="text-center py-8">
                            <FileText className="h-12 w-12 text-red-500 mx-auto mb-4" />
                            <p className="text-red-600 mb-4">{error}</p>
                            <button
                                onClick={handleCompare}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                                Retry
                            </button>
                        </div>
                    )}

                    {/* Comparison Results */}
                    {comparison && (
                        <div className="space-y-6">
                            {/* Summary */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-green-50 rounded-lg p-6">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Plus className="h-5 w-5 text-green-600" />
                                        <h3 className="font-semibold text-green-800">Added</h3>
                                    </div>
                                    <div className="text-2xl font-bold text-green-600">
                                        {comparison.changes.added_features.toLocaleString()}
                                    </div>
                                    <div className="text-sm text-green-700">features</div>
                                </div>
                                <div className="bg-blue-50 rounded-lg p-6">
                                    <div className="flex items-center gap-2 mb-2">
                                        <GitCompare className="h-5 w-5 text-blue-600" />
                                        <h3 className="font-semibold text-blue-800">Modified</h3>
                                    </div>
                                    <div className="text-2xl font-bold text-blue-600">
                                        {comparison.changes.modified_features.toLocaleString()}
                                    </div>
                                    <div className="text-sm text-blue-700">features</div>
                                </div>
                                <div className="bg-red-50 rounded-lg p-6">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Minus className="h-5 w-5 text-red-600" />
                                        <h3 className="font-semibold text-red-800">Deleted</h3>
                                    </div>
                                    <div className="text-2xl font-bold text-red-600">
                                        {comparison.changes.deleted_features.toLocaleString()}
                                    </div>
                                    <div className="text-sm text-red-700">features</div>
                                </div>
                            </div>

                            {/* Change Details */}
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Changes by Category</h3>
                                <div className="bg-white border rounded-lg overflow-hidden">
                                    <table className="w-full">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Category
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Added
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Modified
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Deleted
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {comparison.change_details.map((detail, index) => (
                                                <tr key={index}>
                                                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                                                        {detail.category}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex items-center gap-2">
                                                            {getChangeIcon(detail.added)}
                                                            <span className={getChangeColor(detail.added)}>
                                                                {detail.added.toLocaleString()}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex items-center gap-2">
                                                            {getChangeIcon(detail.modified)}
                                                            <span className={getChangeColor(detail.modified)}>
                                                                {detail.modified.toLocaleString()}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex items-center gap-2">
                                                            {getChangeIcon(-detail.deleted)}
                                                            <span className={getChangeColor(-detail.deleted)}>
                                                                {detail.deleted.toLocaleString()}
                                                            </span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* File Size and Quality Changes */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-gray-50 rounded-lg p-6">
                                    <h3 className="font-semibold text-gray-900 mb-2">File Size Change</h3>
                                    <div className="flex items-center gap-2">
                                        {getChangeIcon(comparison.file_size_change)}
                                        <span className={`text-xl font-bold ${getChangeColor(comparison.file_size_change)}`}>
                                            {comparison.file_size_change > 0 ? '+' : ''}{formatFileSize(Math.abs(comparison.file_size_change))}
                                        </span>
                                    </div>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-6">
                                    <h3 className="font-semibold text-gray-900 mb-2">Data Quality Change</h3>
                                    <div className="flex items-center gap-2">
                                        {getChangeIcon(comparison.data_quality_change)}
                                        <span className={`text-xl font-bold ${getChangeColor(comparison.data_quality_change)}`}>
                                            {comparison.data_quality_change > 0 ? '+' : ''}{comparison.data_quality_change.toFixed(1)}%
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Comparison Date */}
                            <div className="text-sm text-gray-500 text-center pt-4 border-t flex items-center justify-center gap-2">
                                <Calendar className="h-4 w-4" />
                                Comparison generated on {new Date(comparison.comparison_date).toLocaleDateString()}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
} 