import { RegionTree, DataFile } from '@/types';
import { format } from 'date-fns';

interface RegionCardProps {
    region: RegionTree;
    isSelected: boolean;
    onSelect: () => void;
}

export default function RegionCard({ region, isSelected, onSelect }: RegionCardProps) {
    const { region: regionInfo, data_files } = region;
    const latestFile = data_files.find(file => file.is_latest);

    const formatFileSize = (bytes: number): string => {
        const mb = bytes / (1024 * 1024);
        return mb < 1 ? `${(bytes / 1024).toFixed(1)} KB` : `${mb.toFixed(1)} MB`;
    };

    const formatDate = (dateString: string): string => {
        try {
            return format(new Date(dateString), 'MMM dd, yyyy');
        } catch {
            return 'Unknown date';
        }
    };

    return (
        <div
            className={`
        border rounded-lg p-4 cursor-pointer transition-all duration-200
        ${isSelected
                    ? 'border-primary-500 bg-primary-50 shadow-md'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                }
      `}
            onClick={onSelect}
        >
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 text-lg">
                        {regionInfo.name}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                        Level {regionInfo.admin_level} • {regionInfo.country_code || 'N/A'}
                    </p>

                    {regionInfo.area_km2 && (
                        <p className="text-sm text-gray-500 mt-1">
                            Area: {regionInfo.area_km2.toLocaleString()} km²
                        </p>
                    )}

                    <div className="mt-3 space-y-1">
                        {regionInfo.provides_data_services ? (
                            <>
                                <div className="flex items-center text-sm text-gray-600">
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                    {data_files.length} file{data_files.length !== 1 ? 's' : ''} available
                                </div>

                                {latestFile && (
                                    <div className="flex items-center text-sm text-gray-600">
                                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        Latest: {formatDate(latestFile.created_at)} • {formatFileSize(latestFile.file_size)}
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="flex items-center text-sm text-blue-600">
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                </svg>
                                Navigation level • {region.children.length} sub-region{region.children.length !== 1 ? 's' : ''}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex-shrink-0 ml-4">
                    {isSelected && (
                        <div className="w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                    )}
                </div>
            </div>

            {/* Bounding Box Info */}
            <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="text-xs text-gray-500 font-mono">
                    Bounds: {regionInfo.bounding_box.min_lat.toFixed(4)}°N - {regionInfo.bounding_box.max_lat.toFixed(4)}°N, {' '}
                    {regionInfo.bounding_box.min_lon.toFixed(4)}°E - {regionInfo.bounding_box.max_lon.toFixed(4)}°E
                </div>
            </div>
        </div>
    );
} 