# Private Markets Knowledge Store

An AI-powered intelligence system for private markets data with graph database storage and advanced query capabilities.

## 🚀 Features

- **Graph Database**: Neo4j-powered knowledge graph for complex relationships
- **AI Agent Interface**: Natural language querying with OpenAI integration
- **Real-time Analytics**: Live market intelligence and trend analysis
- **RESTful API**: Complete API for data ingestion and querying
- **Scalable Architecture**: Built for production deployment

## 📋 Prerequisites

- Node.js 18+
- Neo4j Database (local or cloud)
- OpenAI API Key

## 🛠 Installation

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Configure your environment variables
# Edit .env with your database and API credentials
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEO4J_URI` | Neo4j database connection URI | ✅ |
| `NEO4J_USERNAME` | Neo4j username | ✅ |
| `NEO4J_PASSWORD` | Neo4j password | ✅ |
| `OPENAI_API_KEY` | OpenAI API key for AI features | ✅ |
| `NODE_ENV` | Environment (development/production) | ✅ |
| `PORT` | Server port (default: 3000) | ❌ |

## 🚀 Deployment

### Railway (Recommended)

1. Fork this repository
2. Connect to Railway
3. Set environment variables
4. Deploy automatically

### Docker

```bash
# Build image
docker build -t knowledge-store .

# Run container
docker run -p 3000:3000 --env-file .env knowledge-store
```

### Local Development

```bash
# Start development server
npm run dev

# Start production server
npm start
```

## 📡 API Endpoints

### Core Endpoints
- `GET /health` - Health check
- `POST /api/agent/query` - Natural language queries
- `GET /api/entities/:id` - Get entity details
- `POST /api/ingest/seed` - Ingest data

### Agent Interface
- `POST /api/agent/conversation` - Start conversation
- `GET /api/agent/conversation/:id` - Get conversation
- `POST /api/agent/conversation/:id/message` - Send message

## 🎯 Usage Examples

### Natural Language Query
```javascript
POST /api/agent/query
{
  "query": "Show me BlackRock's infrastructure investments in renewable energy",
  "context": "investment_analysis"
}
```

### Entity Search
```javascript
GET /api/entities/search?q=BlackRock&type=Organization
```

### Data Ingestion
```javascript
POST /api/ingest/seed
{
  "source": "csv",
  "data": [...],
  "type": "deals"
}
```

## 🏗 Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React/Vue     │    │   REST API      │    │   Neo4j Graph   │
│   Frontend      │◄──►│   Express.js    │◄──►│   Database      │
│   (Optional)    │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                               │
                       ┌───────▼───────┐
                       │   AI Engine   │
                       │   OpenAI GPT  │
                       └───────────────┘
```

## 🔍 Monitoring

- Health endpoint: `/health`
- Metrics: Built-in performance tracking
- Logs: Winston-based structured logging

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🆘 Support

For support and questions:
- Create an issue in this repository
- Check the [API documentation](docs/api.md)
- Review [deployment guide](docs/deployment.md)
