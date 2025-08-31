# Chronologicon Engine

A Node.js backend service for ingesting, managing, and querying historical event data with hierarchical relationships and temporal analysis.

## 🚀 Quick Start

### Prerequisites
- Node.js v18+
- PostgreSQL v12+
- npm

### Installation

1. **Clone and install**
   ```bash
   git clone https://github.com/niharkvira/ChronologiconEngine.git
   cd ChronologiconEngine
   npm install
   ```

2. **Quick Setup (Automated)**
   ```bash
   # Run the setup script for automated configuration
   chmod +x setup.sh
   ./setup.sh
   ```

3. **Manual Setup (Alternative)**
   ```bash
   # Configure environment
   cp env.example .env
   # Edit .env with your database credentials
   
   # Create database
   createdb chronologicon_db
   
   # Run migrations
   npm run db:migrate
   ```

4. **Start server**
   ```bash
   npm start
   # or for development with auto-reload
   npm run dev
   ```

Server runs on `http://localhost:3000`

## 📚 API Endpoints

### File Ingestion
```bash
# Ingest historical data
POST /api/events/ingest
{
  "filePath": "/path/to/sample_historical_data.txt"
}

# Check ingestion status
GET /api/events/ingestion-status/:jobId
```

### Event Operations
```bash
# Get hierarchical timeline
GET /api/timeline/:rootEventId

# Search events
GET /api/events/search?name=phase&limit=10

# CRUD operations
GET /api/events/:eventId
POST /api/events
PUT /api/events/:eventId
DELETE /api/events/:eventId
```

### Insights & Analytics
```bash
# Find overlapping events
GET /api/insights/overlapping-events

# Find temporal gaps
GET /api/insights/temporal-gaps?startDate=2023-01-01T00:00:00Z&endDate=2023-01-31T00:00:00Z

# Event influence analysis
GET /api/insights/event-influence?sourceEventId=uuid1&targetEventId=uuid2
```

## 📄 Data Format

**File Format (pipe-delimited):**
```
EVENT_ID|EVENT_NAME|START_DATE_ISO|END_DATE_ISO|PARENT_ID_OR_NULL|DESCRIPTION
```

**Example:**
```
a1b2c3d4-e5f6-7890-1234-567890abcdef|Founding of ArchaeoData|2023-01-01T10:00:00Z|2023-01-01T11:30:00Z|NULL|Initial establishment of the company.
```

## 🔧 Configuration

**Environment Variables:**
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=chronologicon_db
DB_USER=your_username
DB_PASSWORD=your_password
PORT=3000
NODE_ENV=development
LOG_LEVEL=info
```

## 🧪 Testing

### Sample Data Files
The project includes several sample data files for testing:
- `sample_historical_data.txt` - Main sample data in pipe-delimited format
- `sample_data.csv` - CSV format sample data
- `sample.csv` - Additional CSV sample data

### API Testing
```bash
# Health check
curl http://localhost:3000/api/health

# Test with sample data
curl -X POST http://localhost:3000/api/events/ingest \
  -H "Content-Type: application/json" \
  -d '{"filePath": "'$(pwd)'/sample_historical_data.txt"}'

# Search events after ingestion
curl "http://localhost:3000/api/events/search?name=phase&limit=10"

# Get all events
curl http://localhost:3000/api/events
```

## 📊 Features

- **Asynchronous file processing** with job tracking
- **Hierarchical event relationships** with timeline reconstruction
- **Advanced search** with multi-criteria filtering and pagination
- **Temporal analysis** including overlaps, gaps, and influence paths
- **CSV converter** for bonus file format support
- **Comprehensive error handling** and validation
- **Performance optimized** with database indexing and batch processing

## 🔒 Security

- Input validation with Joi schemas
- SQL injection prevention
- Rate limiting (100 requests/15min per IP)
- CORS configuration
- Security headers with Helmet

## 📝 Documentation

- **Detailed project information**: See [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)
- **API documentation**: Available at `http://localhost:3000/api`
- **Database schema**: See [database_schema.sql](database_schema.sql)

## 🆘 Troubleshooting

**Common Issues:**
- **Database connection failed**: Verify PostgreSQL is running and credentials are correct
- **File not found**: Ensure file paths are absolute and accessible
- **Validation errors**: Check input data format matches expected schema
- **Port in use**: Change PORT in .env or stop conflicting services

**Logs:** Check `logs/` directory for detailed error information

## 💻 Development

### Available Scripts
```bash
npm start          # Start production server
npm run dev        # Start development server with auto-reload
npm run db:migrate # Run database migrations
npm test           # Run tests (if available)
npm run lint       # Run linting
```

### Project Structure
```
ChronologiconEngine/
├── src/
│   ├── config/         # Configuration files
│   ├── controllers/    # Route controllers
│   ├── models/         # Data models
│   ├── services/       # Business logic
│   ├── routes/         # API routes
│   ├── middleware/     # Custom middleware
│   ├── utils/          # Utility functions
│   └── server.js       # Main server file
├── logs/               # Application logs
├── sample_*.txt/csv    # Sample data files
└── database_schema.sql # Database schema
```

## 🤝 Contributing

1. Fork the repository from [https://github.com/niharkvira/ChronologiconEngine](https://github.com/niharkvira/ChronologiconEngine)
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow existing code style and conventions
- Add tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting PR

---

For detailed technical information, architecture decisions, and implementation details, see [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md).