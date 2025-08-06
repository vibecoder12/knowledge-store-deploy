/**
 * Private Markets Knowledge Store
 * Main entry point for the intelligent knowledge system
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const winston = require('winston');

// Core modules
const KnowledgeStore = require('./core/KnowledgeStore');
const GraphDatabase = require('./core/GraphDatabase');
const IntelligenceEngine = require('./intelligence/IntelligenceEngine');
const APIRouter = require('./api/routes');

// Configuration
const config = require('./config/config');

// Logger setup
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'knowledge-store' },
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ]
});

class PrivateMarketsKnowledgeStore {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3000;
        this.knowledgeStore = null;
        this.graphDb = null;
        this.intelligenceEngine = null;
    }

    async initialize() {
        logger.info('🚀 Initializing Private Markets Knowledge Store...');
        
        try {
            // Initialize core components
            this.graphDb = new GraphDatabase(config.neo4j);
            await this.graphDb.connect();
            logger.info('✅ Graph database connected');

            this.intelligenceEngine = new IntelligenceEngine(config.intelligence);
            await this.intelligenceEngine.initialize();
            logger.info('✅ Intelligence engine initialized');

            this.knowledgeStore = new KnowledgeStore({
                graphDb: this.graphDb,
                intelligenceEngine: this.intelligenceEngine,
                config: config
            });
            await this.knowledgeStore.initialize();
            logger.info('✅ Knowledge store initialized');

            // Setup Express middleware
            this.setupMiddleware();
            
            // Setup routes
            this.setupRoutes();

            logger.info('🎯 Private Markets Knowledge Store ready!');
            
        } catch (error) {
            logger.error('❌ Failed to initialize:', error);
            process.exit(1);
        }
    }

    setupMiddleware() {
        this.app.use(helmet());
        this.app.use(compression());
        this.app.use(cors());
        this.app.use(express.json({ limit: '50mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));
        
        // Request logging
        this.app.use((req, res, next) => {
            logger.info(`${req.method} ${req.url}`, {
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });
            next();
        });
    }

    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                version: require('./package.json').version,
                components: {
                    graphDb: this.graphDb?.isConnected() || false,
                    intelligenceEngine: this.intelligenceEngine?.isReady() || false,
                    knowledgeStore: this.knowledgeStore?.isReady() || false
                }
            });
        });

        // API routes
        this.app.use('/api', APIRouter(this.knowledgeStore));

        // Error handling
        this.app.use((error, req, res, next) => {
            logger.error('API Error:', error);
            res.status(error.status || 500).json({
                error: {
                    message: error.message,
                    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
                }
            });
        });

        // 404 handler
        this.app.use((req, res) => {
            res.status(404).json({
                error: {
                    message: 'Endpoint not found',
                    path: req.url
                }
            });
        });
    }

    async start() {
        await this.initialize();
        
        this.server = this.app.listen(this.port, () => {
            logger.info(`🌐 Server running on port ${this.port}`);
            logger.info(`📊 Dashboard: http://localhost:${this.port}/api/dashboard`);
            logger.info(`🔍 Query endpoint: http://localhost:${this.port}/api/query`);
        });

        // Graceful shutdown
        process.on('SIGINT', () => this.shutdown());
        process.on('SIGTERM', () => this.shutdown());
    }

    async shutdown() {
        logger.info('🛑 Shutting down gracefully...');
        
        if (this.server) {
            this.server.close();
        }
        
        if (this.graphDb) {
            await this.graphDb.disconnect();
        }
        
        logger.info('✅ Shutdown complete');
        process.exit(0);
    }
}

// Start the application
const app = new PrivateMarketsKnowledgeStore();

if (require.main === module) {
    app.start().catch(error => {
        logger.error('Failed to start application:', error);
        process.exit(1);
    });
}

module.exports = app;
