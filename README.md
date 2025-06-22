# RieMap - Global Refined OpenStreetMap Data Service

A modern, efficient service for processing and serving regional OpenStreetMap data with quality reports and historical versioning.

## 🏗️ Architecture

- **Backend**: Rust-based OSM data processing pipeline
- **Frontend**: Next.js/TypeScript web portal with interactive maps
- **API**: RESTful endpoints for data access and downloads
- **Storage**: Hierarchical file system with metadata indexing

## 🚀 Features

- 📍 **Map-based region selection** with zoom navigation
- 📂 **Directory-based browsing** with mini-map previews
- 📊 **Quality reports** per region and version
- 🕒 **Historical version comparison**
- ⬇️ **Direct file downloads** for each region/version
- 🔄 **Automated daily processing** pipeline

## 🦀 Backend (Rust)

Located in `/backend/`
- OSM data extraction and filtering
- Periodic processing jobs
- Quality analysis and reporting
- REST API server

## 🌐 Frontend (Next.js)

Located in `/frontend/`
- Interactive map interface
- Region browser and explorer
- Download management
- Quality report visualization

## 🧪 Testbed: Liechtenstein

We use Liechtenstein as our initial testbed region due to:
- Small dataset size (~2MB)
- Complete administrative boundaries
- Good for development and testing

## 🛠️ Quick Start

### Prerequisites
- **Rust** (1.70+): Install from [rustup.rs](https://rustup.rs/)
- **Node.js** (18+): Install from [nodejs.org](https://nodejs.org/)
- **Git**: For cloning the repository

### Automatic Setup
```bash
# Make setup script executable and run
chmod +x setup.sh
./setup.sh
```

### Manual Setup

#### Backend Setup
```bash
cd backend

# Install dependencies and build
cargo build --release

# Initialize sample data
cargo run --bin riemap-processor init

# Download Liechtenstein data (our testbed)
cargo run --bin riemap-processor download liechtenstein

# Start the API server
cargo run --bin riemap-server
```

#### Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

### Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Health Check**: http://localhost:3001/ 

## 🚀 Usage

### CLI Commands
```bash
# List available regions
cargo run --bin riemap-processor list

# Download data for a region
cargo run --bin riemap-processor download liechtenstein

# Process existing data and generate quality reports
cargo run --bin riemap-processor process liechtenstein
```

### API Endpoints
- `GET /api/regions` - List all regions
- `GET /api/regions/{id}` - Get region details
- `GET /api/regions/{id}/files` - List files for region
- `GET /api/regions/{id}/compare?from=v1&to=v2` - Compare versions
- `POST /api/regions/{id}/process` - Trigger processing
- `GET /download/{region}/{version}` - Download data file

## 📁 Data Structure

```
/data/
  /europe/
    /liechtenstein/
      latest.osm.pbf
      2024-12-01.osm.pbf
      report_2024-12-01.json
      metadata.json
``` 