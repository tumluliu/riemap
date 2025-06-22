import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'RieMap - Global OpenStreetMap Data Service',
    description: 'A modern platform for accessing refined OpenStreetMap data with quality reports and historical versioning.',
    keywords: 'OpenStreetMap, OSM, data, quality, mapping, GIS',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
            <body className={inter.className}>
                <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
                    <header className="bg-white border-b border-gray-200 shadow-sm">
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                            <div className="flex justify-between items-center py-4">
                                <div className="flex items-center">
                                    <h1 className="text-xl font-semibold text-gray-800">
                                        OpenStreetMap Data Portal
                                    </h1>
                                </div>
                                <nav className="flex space-x-6">
                                    <a href="/" className="text-gray-700 hover:text-primary-600 font-medium">
                                        Home
                                    </a>
                                    <a href="/regions" className="text-gray-700 hover:text-primary-600 font-medium">
                                        Regions
                                    </a>
                                    <a href="/about" className="text-gray-700 hover:text-primary-600 font-medium">
                                        About
                                    </a>
                                </nav>
                            </div>
                        </div>
                    </header>

                    <main className="flex-1">
                        {children}
                    </main>

                    <footer className="bg-gray-900 text-gray-300">
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                            <div className="text-center">
                                <p className="text-sm">
                                    © 2024 RieMap. Built with Rust & Next.js.
                                    <a href="https://openstreetmap.org" className="ml-2 text-primary-400 hover:text-primary-300">
                                        Data © OpenStreetMap contributors
                                    </a>
                                </p>
                            </div>
                        </div>
                    </footer>
                </div>
            </body>
        </html>
    )
} 