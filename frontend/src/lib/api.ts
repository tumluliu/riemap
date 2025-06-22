import axios, { AxiosInstance } from 'axios';
import {
    RegionTree,
    QualityReport,
    RegionComparison,
    ProcessingJob,
    DataFile,
} from '@/types';

class ApiClient {
    private client: AxiosInstance;

    constructor(baseURL = '/api') {
        this.client = axios.create({
            baseURL,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
            },
        });

        // Add request interceptor for logging
        this.client.interceptors.request.use(
            (config: any) => {
                console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`);
                return config;
            },
            (error: any) => {
                console.error('❌ API Request Error:', error);
                return Promise.reject(error);
            }
        );

        // Add response interceptor for error handling
        this.client.interceptors.response.use(
            (response: any) => {
                console.log(`✅ API Response: ${response.status} ${response.config.url}`);
                return response;
            },
            (error: any) => {
                console.error('❌ API Response Error:', error);
                if (error.response) {
                    // Server responded with error status
                    console.error('Error details:', error.response.data);
                } else if (error.request) {
                    // Request made but no response received
                    console.error('No response received:', error.request);
                } else {
                    // Something else happened
                    console.error('Request setup error:', error.message);
                }
                return Promise.reject(error);
            }
        );
    }

    // Health check
    async healthCheck() {
        const response = await this.client.get('/');
        return response.data;
    }

    // Region endpoints
    async getRegions(): Promise<RegionTree[]> {
        const response = await this.client.get('/regions');
        return response.data;
    }

    async getRegion(regionId: string): Promise<RegionTree> {
        const response = await this.client.get(`/regions/${regionId}`);
        return response.data;
    }

    async getRegionFiles(regionId: string): Promise<DataFile[]> {
        const response = await this.client.get(`/regions/${regionId}/files`);
        return response.data;
    }

    async compareVersions(
        regionId: string,
        fromVersion: string,
        toVersion: string
    ): Promise<RegionComparison> {
        const response = await this.client.get(`/regions/${regionId}/compare`, {
            params: { from: fromVersion, to: toVersion },
        });
        return response.data;
    }

    async processRegion(regionId: string): Promise<ProcessingJob> {
        const response = await this.client.post(`/regions/${regionId}/process`);
        return response.data;
    }

    // Quality report endpoints
    async getQualityReport(reportId: string): Promise<QualityReport> {
        const response = await this.client.get(`/reports/${reportId}`);
        return response.data;
    }

    // Download endpoint
    getDownloadUrl(regionId: string, version: string): string {
        return `/download/${regionId}/${version}`;
    }

    async downloadFile(regionId: string, version: string): Promise<Blob> {
        const response = await this.client.get(`/download/${regionId}/${version}`, {
            responseType: 'blob',
        });
        return response.data;
    }
}

// Create singleton instance
export const apiClient = new ApiClient();

// Export utility functions
export const api = {
    // Direct function exports for backward compatibility
    getRegions: () => apiClient.getRegions(),
    getQualityReport: (reportId: string) => apiClient.getQualityReport(reportId),
    getStats: async () => {
        // Mock stats data - replace with actual endpoint when backend supports it
        return {
            total_regions: 195,
            total_area_km2: 148940000,
            last_updated: new Date().toISOString()
        };
    },

    // Nested structure for organized access
    regions: {
        list: () => apiClient.getRegions(),
        get: (id: string) => apiClient.getRegion(id),
        getFiles: (id: string) => apiClient.getRegionFiles(id),
        compare: (id: string, from: string, to: string) =>
            apiClient.compareVersions(id, from, to),
        process: (id: string) => apiClient.processRegion(id),
    },
    reports: {
        get: (id: string) => apiClient.getQualityReport(id),
    },
    downloads: {
        getUrl: (regionId: string, version: string) =>
            apiClient.getDownloadUrl(regionId, version),
        download: (regionId: string, version: string) =>
            apiClient.downloadFile(regionId, version),
    },
    health: () => apiClient.healthCheck(),
};

export default apiClient; 