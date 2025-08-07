/**
 * Private Markets Knowledge Store - Railway Deployment
 * Main entry point for the intelligent knowledge system
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const winston = require('winston');
const rateLimit = require('express-rate-limit');

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
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ]
});

// Mock Neo4j connection for Railway deployment
class MockNeo4jConnection {
    constructor() {
        this.connected = true;
        // Sample private markets data
        this.sampleData = {
            privateEquityFirms: [
                { id: '1', name: 'Blackstone', type: 'Private Equity Firm', aum: 991000000000, location: 'New York, USA' },
                { id: '2', name: 'KKR', type: 'Private Equity Firm', aum: 504000000000, location: 'New York, USA' },
                { id: '3', name: 'Apollo Global Management', type: 'Private Equity Firm', aum: 523000000000, location: 'New York, USA' },
                { id: '4', name: 'Carlyle Group', type: 'Private Equity Firm', aum: 376000000000, location: 'Washington DC, USA' },
                { id: '5', name: 'TPG', type: 'Private Equity Firm', aum: 135000000000, location: 'Texas, USA' }
            ],
            portfolioCompanies: [
                { id: '101', name: 'Hilton Hotels', type: 'Portfolio Company', sector: 'Hospitality', investor: 'Blackstone' },
                { id: '102', name: 'Dollar General', type: 'Portfolio Company', sector: 'Retail', investor: 'KKR' },
                { id: '103', name: 'ADT Security', type: 'Portfolio Company', sector: 'Security', investor: 'Apollo' }
            ]
        };
    }

    async connect() {
        logger.info('✅ Mock Neo4j connection established');
        return true;
    }

    isConnected() {
        return this.connected;
    }

    async getStats() {
        return {
            totalEntities: 73612,
            totalRelationships: 201855,
            entityTypeBreakdown: [
                { type: 'Portfolio Company', count: 34516 },
                { type: 'Private Equity Firm', count: 18554 },
                { type: 'Hedge Fund Manager', count: 11701 },
                { type: 'Real Estate Fund Manager', count: 7678 },
                { type: 'Infrastructure Fund Manager', count: 703 },
                { type: 'Other', count: 460 }
            ],
            relationshipTypeBreakdown: [
                { type: 'INVESTED_IN', count: 114624 },
                { type: 'LED_INVESTMENT_IN', count: 40333 },
                { type: 'BOARD_MEMBER_OF', count: 40333 },
                { type: 'CO_INVESTED_WITH', count: 3281 },
                { type: 'ACQUIRED', count: 2050 },
                { type: 'DIVESTED', count: 1234 }
            ]
        };
    }

    async executeQuery(query, options = {}) {
        logger.info(`Executing query: ${query.substring(0, 100)}...`);
        
        // Simple query simulation based on keywords
        const queryLower = query.toLowerCase();
        let results = [];
        
        if (queryLower.includes('private equity') || queryLower.includes('pe firms')) {
            results = this.sampleData.privateEquityFirms.slice(0, 10);
        } else if (queryLower.includes('portfolio') || queryLower.includes('companies')) {
            results = this.sampleData.portfolioCompanies.slice(0, 10);
        } else if (queryLower.includes('blackstone')) {
            results = this.sampleData.privateEquityFirms.filter(firm => 
                firm.name.toLowerCase().includes('blackstone')
            );
        } else {
            // Default to top PE firms
            results = this.sampleData.privateEquityFirms.slice(0, 5);
        }

        return {
            success: true,
            results: results,
            query: query,
            intent: {
                text: query,
                intent: 'general_search',
                entityTypes: ['COMPANY', 'FUND'],
                keywords: queryLower.split(' ').filter(word => word.length > 2),
                entities: [
                    { text: 'private equity', type: 'SECTOR', confidence: 0.9 }
                ],
                confidence: 0.8,
                complexity: 'simple'
            },
            metadata: {
                processingTime: Math.floor(Math.random() * 500) + 100,
                totalResults: results.length,
                cached: false
            }
        };
    }

    async disconnect() {
        this.connected = false;
        logger.info('✅ Mock Neo4j connection closed');
    }
}

class PrivateMarketsKnowledgeStore {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3000;
        this.neo4j = new MockNeo4jConnection();
    }

    async initialize() {
        logger.info('🚀 Initializing Private Markets Knowledge Store on Railway...');
        
        try {
            // Connect to mock database
            await this.neo4j.connect();
            
            // Setup Express middleware
            this.setupMiddleware();
            
            // Setup routes
            this.setupRoutes();

            logger.info('🎯 Private Markets Knowledge Store ready for Railway deployment!');
            
        } catch (error) {
            logger.error('❌ Failed to initialize:', error);
            throw error;
        }
    }

    setupMiddleware() {
        // Rate limiting
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 1000, // limit each IP to 1000 requests per windowMs
            message: 'Too many requests from this IP, please try again later.'
        });
        
        this.app.use(helmet());
        this.app.use(compression());
        this.app.use(cors());
        this.app.use(limiter);
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
        
        // Request logging
        this.app.use((req, res, next) => {
            logger.info(`${req.method} ${req.url}`, {
                ip: req.ip,
                userAgent: req.get('User-Agent')?.substring(0, 100)
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
                environment: process.env.NODE_ENV || 'development',
                deployment: 'railway',
                components: {
                    graphDb: this.neo4j.isConnected(),
                    intelligenceEngine: true,
                    knowledgeStore: true
                }
            });
        });

        // Welcome message
        this.app.get('/', (req, res) => {
            res.json({
                message: '🎯 Welcome to Private Markets Intelligence Agent',
                description: 'AI-powered knowledge system for private markets data',
                version: require('./package.json').version,
                endpoints: {
                    health: '/health',
                    stats: '/api/stats',
                    query: '/api/query',
                    agent: '/api/agent/query',
                    conversation: '/api/agent/conversation'
                },
                documentation: 'https://github.com/vibecoder12/knowledge-store-deploy'
            });
        });

        // Database stats
        this.app.get('/api/stats', async (req, res) => {
            try {
                const stats = await this.neo4j.getStats();
                res.json({
                    success: true,
                    data: stats
                });
            } catch (error) {
                logger.error('Stats error:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Main query endpoint
        this.app.post('/api/query', async (req, res) => {
            try {
                const { query, options = {} } = req.body;

                if (!query || typeof query !== 'string') {
                    return res.status(400).json({
                        success: false,
                        error: 'Query is required and must be a string'
                    });
                }

                const result = await this.neo4j.executeQuery(query, options);
                
                res.json({
                    success: true,
                    data: result
                });
            } catch (error) {
                logger.error('Query error:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Enhanced agent query endpoint
        this.app.post('/api/agent/query', async (req, res) => {
            try {
                const { query, sessionId, context = {} } = req.body;
                
                if (!query || typeof query !== 'string') {
                    return res.status(400).json({
                        success: false,
                        error: 'Query is required and must be a string'
                    });
                }

                const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                const timestamp = new Date().toISOString();
                
                logger.info(`Agent query: ${query}`, { requestId, sessionId });
                
                const result = await this.neo4j.executeQuery(query, { sessionId, ...context });
                
                const response = {
                    success: true,
                    requestId,
                    timestamp,
                    sessionId: sessionId || requestId,
                    data: {
                        query,
                        response: result,
                        metadata: {
                            processingTime: result.metadata?.processingTime || 150,
                            entityCount: result.results?.length || 0,
                            confidence: 'high',
                            sources: 'Private Markets Knowledge Store (Railway Demo)'
                        }
                    }
                };
                
                res.json(response);
                
            } catch (error) {
                logger.error('Agent query failed:', error);
                res.status(500).json({
                    success: false,
                    error: { message: 'Query processing failed' }
                });
            }
        });

        // Conversation endpoint
        this.app.post('/api/agent/conversation', async (req, res) => {
            try {
                const { message, conversationId, userId } = req.body;
                
                if (!message) {
                    return res.status(400).json({
                        success: false,
                        error: 'Message is required'
                    });
                }

                const sessionId = conversationId || `conv_${Date.now()}`;
                const result = await this.neo4j.executeQuery(message, { conversational: true });
                
                let responseText = `I found ${result.results?.length || 0} relevant results for "${message}".`;
                
                if (result.results && result.results.length > 0) {
                    const topResult = result.results[0];
                    responseText += ` The top result is ${topResult.name}`;
                    if (topResult.type) responseText += ` (${topResult.type})`;
                    if (topResult.aum) {
                        responseText += ` with $${(topResult.aum / 1000000000).toFixed(1)}B AUM`;
                    }
                    responseText += '.';
                }
                
                res.json({
                    success: true,
                    conversationId: sessionId,
                    timestamp: new Date().toISOString(),
                    data: {
                        message: responseText,
                        queryResults: result,
                        suggestions: [
                            "Tell me more about the top result",
                            "Show me similar companies",
                            "What are the investment trends?"
                        ]
                    }
                });
            } catch (error) {
                logger.error('Conversation error:', error);
                res.status(500).json({
                    success: false,
                    error: { message: 'Could not process your message' }
                });
            }
        });

        // Analytics endpoint
        this.app.get('/api/agent/analytics', (req, res) => {
            res.json({
                success: true,
                data: {
                    timeRange: req.query.timeRange || '24h',
                    timestamp: new Date().toISOString(),
                    metrics: {
                        totalQueries: Math.floor(Math.random() * 1000) + 500,
                        averageResponseTime: Math.floor(Math.random() * 500) + 150,
                        successRate: 0.98,
                        deployment: 'railway'
                    }
                }
            });
        });

        // Error handling
        this.app.use((error, req, res, next) => {
            logger.error('API Error:', error);
            res.status(error.status || 500).json({
                success: false,
                error: {
                    message: error.message,
                    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
                }
            });
        });

        // 404 handler
        this.app.use((req, res) => {
            res.status(404).json({
                success: false,
                error: {
                    message: 'Endpoint not found',
                    path: req.url,
                    availableEndpoints: ['/', '/health', '/api/stats', '/api/query', '/api/agent/query']
                }
            });
        });
    }

    async start() {
        await this.initialize();
        
        this.server = this.app.listen(this.port, '0.0.0.0', () => {
            logger.info(`🌐 Private Markets Intelligence Agent running on port ${this.port}`);
            logger.info(`🚀 Railway deployment ready!`);
            logger.info(`📊 Health check: https://your-app.up.railway.app/health`);
            logger.info(`🔍 Query endpoint: https://your-app.up.railway.app/api/query`);
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
        
        if (this.neo4j) {
            await this.neo4j.disconnect();
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
