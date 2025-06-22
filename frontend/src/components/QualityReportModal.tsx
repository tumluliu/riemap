'use client'

import { useState, useEffect } from 'react'
import { X, AlertTriangle, CheckCircle, XCircle, BarChart3 } from 'lucide-react'
import { api } from '@/lib/api'
import { QualityReport } from '@/types'

interface QualityReportModalProps {
    isOpen: boolean
    onClose: () => void
    regionId: string
    regionName: string
}

export default function QualityReportModal({ isOpen, onClose, regionId, regionName }: QualityReportModalProps) {
    const [report, setReport] = useState<QualityReport | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (isOpen && regionId) {
            loadQualityReport()
        }
    }, [isOpen, regionId])

    const loadQualityReport = async () => {
        try {
            setLoading(true)
            setError(null)
            const reportData = await api.getQualityReport(regionId)
            setReport(reportData)
        } catch (err) {
            setError('Failed to load quality report')
            console.error('Error loading quality report:', err)
        } finally {
            setLoading(false)
        }
    }

    const getScoreColor = (score: number) => {
        if (score >= 90) return 'text-green-600'
        if (score >= 70) return 'text-yellow-600'
        return 'text-red-600'
    }

    const getScoreIcon = (score: number) => {
        if (score >= 90) return <CheckCircle className="h-5 w-5 text-green-600" />
        if (score >= 70) return <AlertTriangle className="h-5 w-5 text-yellow-600" />
        return <XCircle className="h-5 w-5 text-red-600" />
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900">Quality Report</h2>
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
                    {loading && (
                        <div className="text-center py-8">
                            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                            <p className="text-gray-600">Loading quality report...</p>
                        </div>
                    )}

                    {error && (
                        <div className="text-center py-8">
                            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                            <p className="text-red-600 mb-4">{error}</p>
                            <button
                                onClick={loadQualityReport}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                                Retry
                            </button>
                        </div>
                    )}

                    {report && (
                        <div className="space-y-6">
                            {/* Overall Score */}
                            <div className="bg-gray-50 rounded-lg p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-semibold text-gray-900">Overall Quality Score</h3>
                                    <div className="flex items-center gap-2">
                                        {getScoreIcon(report.overall_score)}
                                        <span className={`text-2xl font-bold ${getScoreColor(report.overall_score)}`}>
                                            {report.overall_score}%
                                        </span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="text-center">
                                        <div className={`text-xl font-semibold ${getScoreColor(report.completeness_score)}`}>
                                            {report.completeness_score}%
                                        </div>
                                        <div className="text-sm text-gray-600">Completeness</div>
                                    </div>
                                    <div className="text-center">
                                        <div className={`text-xl font-semibold ${getScoreColor(report.accuracy_score)}`}>
                                            {report.accuracy_score}%
                                        </div>
                                        <div className="text-sm text-gray-600">Accuracy</div>
                                    </div>
                                    <div className="text-center">
                                        <div className={`text-xl font-semibold ${getScoreColor(report.freshness_score)}`}>
                                            {report.freshness_score}%
                                        </div>
                                        <div className="text-sm text-gray-600">Freshness</div>
                                    </div>
                                </div>
                            </div>

                            {/* Issues Summary */}
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Issues Summary</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="bg-red-50 rounded-lg p-4">
                                        <div className="text-2xl font-bold text-red-600">{report.issues.missing_tags}</div>
                                        <div className="text-sm text-red-800">Missing Tags</div>
                                    </div>
                                    <div className="bg-orange-50 rounded-lg p-4">
                                        <div className="text-2xl font-bold text-orange-600">{report.issues.geometry_errors}</div>
                                        <div className="text-sm text-orange-800">Geometry Errors</div>
                                    </div>
                                    <div className="bg-yellow-50 rounded-lg p-4">
                                        <div className="text-2xl font-bold text-yellow-600">{report.issues.topology_issues}</div>
                                        <div className="text-sm text-yellow-800">Topology Issues</div>
                                    </div>
                                    <div className="bg-blue-50 rounded-lg p-4">
                                        <div className="text-2xl font-bold text-blue-600">{report.issues.outdated_data}</div>
                                        <div className="text-sm text-blue-800">Outdated Data</div>
                                    </div>
                                </div>
                            </div>

                            {/* Recommendations */}
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recommendations</h3>
                                <div className="space-y-2">
                                    {report.recommendations.map((recommendation, index) => (
                                        <div key={index} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                                            <BarChart3 className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                                            <p className="text-blue-800">{recommendation}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Report Date */}
                            <div className="text-sm text-gray-500 text-center pt-4 border-t">
                                Report generated on {new Date(report.report_date).toLocaleDateString()}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
} 