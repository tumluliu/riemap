/** @type {import('next').NextConfig} */
const nextConfig = {
    async rewrites() {
        return [
            {
                source: '/api/:path*',
                destination: 'http://localhost:3001/api/:path*',
            },
            {
                source: '/download/:path*',
                destination: 'http://localhost:3001/download/:path*',
            },
        ]
    },
}

module.exports = nextConfig 