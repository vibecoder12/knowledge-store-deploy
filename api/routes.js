/**
 * API Routes for Private Markets Knowledge Store
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const SeedDataIngester = require('../ingestion/SeedDataIngester');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.simple(),
    defaultMeta: { service: 'api' },
    transports: [new winston.transports.Console()]
});

function createAPIRoutes(knowledgeStore) {
    const router = express.Router();

    // Rate limiting
    const limiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 1000, // limit each IP to 1000 requests per windowMs
        message: 'Too many requests from this IP, please try again later.'
    });
    router.use(limiter);

    // Middleware for error handling
    const asyncHandler = (fn) => (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };

    /**
     * GET /api/stats
     * Get knowledge store statistics
     */
    router.get('/stats', asyncHandler(async (req, res) => {
        const stats = await knowledgeStore.getStats();
        res.json({
            success: true,
            data: stats
        });
    }));

    /**
     * POST /api/query
     * Main query endpoint for natural language queries
     */
    router.post('/query', asyncHandler(async (req, res) => {
        const { query, options = {} } = req.body;

        if (!query || typeof query !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Query is required and must be a string'
            });
        }

        const startTime = Date.now();
        options.startTime = startTime;

        const result = await knowledgeStore.query(query, options);
        
        res.json({
            success: true,
            data: result
        });
    }));

    /**
     * POST /api/agent/query
     * Enhanced agent query endpoint with session tracking
     */
    router.post('/agent/query', asyncHandler(async (req, res) => {
        const { query, sessionId, context = {} } = req.body;
        
        if (!query || typeof query !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Query is required and must be a string'
            });
        }

        const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const timestamp = new Date().toISOString();
        
        logger.info(`Agent query received: ${query}`, { requestId, sessionId });
        
        try {
            // Process query through knowledge store
            const result = await knowledgeStore.query(query, {
                sessionId,
                requestId,
                timestamp,
                ...context
            });
            
            // Enhanced response format
            const response = {
                success: true,
                requestId,
                timestamp,
                sessionId: sessionId || requestId,
                data: {
                    query,
                    response: result,
                    metadata: {
                        processingTime: Date.now() - new Date(timestamp).getTime(),
                        entityCount: result.results ? result.results.length : 0,
                        confidence: result.intent ? result.intent.confidence || 'medium' : 'medium',
                        sources: 'Private Markets Knowledge Store'
                    }
                }
            };
            
            res.json(response);
            
        } catch (error) {
            logger.error('Agent query failed:', error, { requestId, sessionId });
            res.status(500).json({
                success: false,
                requestId,
                timestamp,
                error: {
                    message: 'Query processing failed',
                    details: process.env.NODE_ENV === 'development' ? error.message : undefined
                }
            });
        }
    }));

    /**
     * GET /api/agent/analytics
     * Get agent usage analytics
     */
    router.get('/agent/analytics', asyncHandler(async (req, res) => {
        const { timeRange = '24h' } = req.query;
        
        // Mock analytics data (in production, this would come from a real analytics store)
        const analytics = {
            timeRange,
            timestamp: new Date().toISOString(),
            metrics: {
                totalQueries: Math.floor(Math.random() * 1000) + 500,
                averageResponseTime: Math.floor(Math.random() * 1000) + 200,
                successRate: 0.97,
                topQueryTypes: [
                    { type: 'company_search', count: 234, percentage: 34.2 },
                    { type: 'fund_analysis', count: 189, percentage: 27.6 },
                    { type: 'market_trends', count: 156, percentage: 22.8 },
                    { type: 'investment_patterns', count: 105, percentage: 15.4 }
                ],
                topEntities: [
                    { name: 'Sequoia Capital', queries: 45 },
                    { name: 'Blackstone', queries: 38 },
                    { name: 'KKR', queries: 32 },
                    { name: 'Apollo', queries: 28 }
                ],
                entityCoverage: {
                    privateEquity: 18554,
                    hedgeFunds: 11701,
                    realEstate: 7678,
                    infrastructure: 703
                }
            }
        };
        
        res.json({
            success: true,
            data: analytics
        });
    }));

    /**
     * POST /api/agent/conversation
     * Start or continue a conversation with the agent
     */
    router.post('/agent/conversation', asyncHandler(async (req, res) => {
        const { message, conversationId, userId } = req.body;
        
        if (!message || typeof message !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Message is required and must be a string'
            });
        }

        const sessionId = conversationId || `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const timestamp = new Date().toISOString();
        
        logger.info(`Conversation message: ${message}`, { sessionId, userId });
        
        try {
            // Process through knowledge store
            const queryResult = await knowledgeStore.query(message, {
                sessionId,
                userId,
                conversational: true
            });
            
            // Format as conversational response
            let responseText = `I found ${queryResult.results ? queryResult.results.length : 0} relevant results for your query about "${message}".`;
            
            if (queryResult.results && queryResult.results.length > 0) {
                const topResult = queryResult.results[0];
                if (topResult.name) {
                    responseText += ` The top result is ${topResult.name}`;
                    if (topResult.type) {
                        responseText += ` (${topResult.type})`;
                    }
                    if (topResult.aum) {
                        responseText += ` with $${(topResult.aum / 1000000000).toFixed(1)}B AUM`;
                    }
                    responseText += '.';
                }
            }
            
            const response = {
                success: true,
                conversationId: sessionId,
                timestamp,
                data: {
                    message: responseText,
                    queryResults: queryResult,
                    suggestions: [
                        "Tell me more about the top result",
                        "Show me similar companies",
                        "What are the investment trends?"
                    ]
                }
            };
            
            res.json(response);
            
        } catch (error) {
            logger.error('Conversation processing failed:', error, { sessionId, userId });
            res.status(500).json({
                success: false,
                conversationId: sessionId,
                timestamp,
                error: {
                    message: 'Could not process your message',
                    details: process.env.NODE_ENV === 'development' ? error.message : undefined
                }
            });
        }
    }));

    /**
     * GET /api/entities
     * Search and filter entities
     */
    router.get('/entities', asyncHandler(async (req, res) => {
        const {
            type,
            name,
            sector,
            country,
            minAum,
            limit = 50,
            offset = 0
        } = req.query;

        const filters = {};
        if (type) filters.type = type;
        if (name) filters.name = name;
        if (sector) filters.sector = sector;
        if (country) filters.country = country;
        if (minAum) filters.minAum = parseFloat(minAum);

        const entities = await knowledgeStore.graphDb.findEntities(filters, parseInt(limit));
        
        res.json({
            success: true,
            data: {
                entities: entities.slice(parseInt(offset)),
                filters: filters,
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    total: entities.length
                }
            }
        });
    }));

    /**
     * GET /api/entities/:id
     * Get specific entity by ID
     */
    router.get('/entities/:id', asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { includeRelationships = true } = req.query;

        const entities = await knowledgeStore.graphDb.findEntities({ id }, 1);
        
        if (entities.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Entity not found'
            });
        }

        const entity = entities[0];
        const result = { entity };

        if (includeRelationships === 'true') {
            result.relationships = await knowledgeStore.graphDb.findRelationships(id);
        }

        res.json({
            success: true,
            data: result
        });
    }));

    /**
     * GET /api/entities/:id/similar
     * Find entities similar to the specified entity
     */
    router.get('/entities/:id/similar', asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { 
            similarity = 0.7, 
            limit = 10 
        } = req.query;

        const result = await knowledgeStore.findSimilarEntities(id, {
            similarity: parseFloat(similarity),
            limit: parseInt(limit)
        });

        res.json({
            success: true,
            data: result
        });
    }));

    /**
     * GET /api/relationships/:fromId/:toId
     * Find shortest path between two entities
     */
    router.get('/relationships/:fromId/:toId', asyncHandler(async (req, res) => {
        const { fromId, toId } = req.params;
        const { maxHops = 6 } = req.query;

        const path = await knowledgeStore.graphDb.findShortestPath(
            fromId, 
            toId, 
            parseInt(maxHops)
        );

        if (!path) {
            return res.status(404).json({
                success: false,
                error: 'No path found between the specified entities'
            });
        }

        res.json({
            success: true,
            data: {
                path,
                fromId,
                toId
            }
        });
    }));

    /**
     * POST /api/entities
     * Add new entity
     */
    router.post('/entities', asyncHandler(async (req, res) => {
        const entityData = req.body;

        if (!entityData.name || !entityData.type) {
            return res.status(400).json({
                success: false,
                error: 'Entity name and type are required'
            });
        }

        const entity = await knowledgeStore.addEntity(entityData);

        res.status(201).json({
            success: true,
            data: { entity }
        });
    }));

    /**
     * POST /api/entities/batch
     * Add multiple entities in batch
     */
    router.post('/entities/batch', asyncHandler(async (req, res) => {
        const { entities, options = {} } = req.body;

        if (!Array.isArray(entities) || entities.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Entities array is required and must not be empty'
            });
        }

        const result = await knowledgeStore.addEntities(entities, options);

        res.json({
            success: true,
            data: result
        });
    }));

    /**
     * GET /api/patterns
     * Discover patterns in the knowledge graph
     */
    router.get('/patterns', asyncHandler(async (req, res) => {
        const options = {
            limit: parseInt(req.query.limit) || 50,
            minSupport: parseFloat(req.query.minSupport) || 0.1,
            types: req.query.types ? req.query.types.split(',') : undefined
        };

        const patterns = await knowledgeStore.discoverPatterns(options);

        res.json({
            success: true,
            data: {
                patterns,
                options
            }
        });
    }));

    /**
     * GET /api/intelligence
     * Get market intelligence and insights
     */
    router.get('/intelligence', asyncHandler(async (req, res) => {
        const options = {
            sectors: req.query.sectors ? req.query.sectors.split(',') : undefined,
            regions: req.query.regions ? req.query.regions.split(',') : undefined,
            timeframe: req.query.timeframe || '1y'
        };

        const intelligence = await knowledgeStore.getMarketIntelligence(options);

        res.json({
            success: true,
            data: intelligence
        });
    }));

    /**
     * POST /api/ingest/seed
     * Ingest seed data files
     */
    router.post('/ingest/seed', asyncHandler(async (req, res) => {
        const ingester = new SeedDataIngester(knowledgeStore, knowledgeStore.config);
        
        logger.info('🚀 Starting seed data ingestion via API...');
        const result = await ingester.ingestAllSeedData();

        res.json({
            success: true,
            data: result,
            message: `Ingested ${result.successful} entities successfully`
        });
    }));

    /**
     * GET /api/ingest/stats
     * Get ingestion statistics
     */
    router.get('/ingest/stats', asyncHandler(async (req, res) => {
        const ingester = new SeedDataIngester(knowledgeStore, knowledgeStore.config);
        const stats = await ingester.getIngestionStats();

        res.json({
            success: true,
            data: stats
        });
    }));

    /**
     * POST /api/cypher
     * Execute custom Cypher query (advanced users)
     */
    router.post('/cypher', asyncHandler(async (req, res) => {
        const { query, parameters = {} } = req.body;

        if (!query || typeof query !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Cypher query is required'
            });
        }

        // Security: Only allow read queries
        const queryLower = query.toLowerCase().trim();
        const writingOperations = ['create', 'merge', 'set', 'delete', 'remove', 'drop'];
        
        if (writingOperations.some(op => queryLower.includes(op))) {
            return res.status(403).json({
                success: false,
                error: 'Only read queries are allowed'
            });
        }

        const result = await knowledgeStore.graphDb.executeCustomQuery(query, parameters);

        res.json({
            success: true,
            data: result
        });
    }));

    /**
     * GET /api/dashboard
     * Dashboard data for visualization
     */
    router.get('/dashboard', asyncHandler(async (req, res) => {
        const [stats, patterns] = await Promise.all([
            knowledgeStore.getStats(),
            knowledgeStore.discoverPatterns({ limit: 10 })
        ]);

        // Get top entities by connections
        const topEntitiesQuery = `
            MATCH (e:Entity)-[r]-()
            RETURN e.name as name, e.type as type, count(r) as connections
            ORDER BY connections DESC
            LIMIT 10
        `;
        const topEntities = await knowledgeStore.graphDb.executeCustomQuery(topEntitiesQuery);

        // Get recent activity (placeholder - would need timestamps)
        const recentActivity = [];

        res.json({
            success: true,
            data: {
                overview: {
                    totalEntities: stats.totalEntities,
                    totalRelationships: stats.totalRelationships,
                    entityTypes: stats.entityTypeBreakdown,
                    relationshipTypes: stats.relationshipTypeBreakdown
                },
                topEntities: topEntities.records,
                patterns: patterns.slice(0, 5),
                recentActivity,
                cache: stats.cache,
                lastUpdated: new Date().toISOString()
            }
        });
    }));

    /**
     * DELETE /api/clear
     * Clear entire database (development only)
     */
    router.delete('/clear', asyncHandler(async (req, res) => {
        if (process.env.NODE_ENV === 'production') {
            return res.status(403).json({
                success: false,
                error: 'Database clear is not allowed in production'
            });
        }

        await knowledgeStore.graphDb.clearDatabase();

        res.json({
            success: true,
            message: 'Database cleared successfully'
        });
    }));

    // Error handling middleware
    router.use((error, req, res, next) => {
        logger.error('API Error:', {
            error: error.message,
            stack: error.stack,
            url: req.url,
            method: req.method,
            body: req.body
        });

        res.status(error.status || 500).json({
            success: false,
            error: {
                message: error.message,
                ...(process.env.NODE_ENV === 'development' && {
                    stack: error.stack
                })
            }
        });
    });

    return router;
}

module.exports = createAPIRoutes;
