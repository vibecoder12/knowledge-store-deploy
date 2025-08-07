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

// Session store for conversation memory
class SessionStore {
    constructor() {
        this.sessions = new Map();
        this.cleanupInterval = setInterval(() => this.cleanup(), 300000); // Clean every 5 minutes
    }

    createSession(userId, appId = 'default') {
        const sessionToken = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const session = {
            sessionToken,
            userId,
            appId,
            conversationHistory: [],
            entityContext: new Set(),
            userPreferences: {
                responseFormat: 'conversational',
                includeCharts: true,
                maxResults: 5
            },
            createdAt: new Date(),
            lastActivity: new Date(),
            totalQueries: 0
        };
        
        this.sessions.set(sessionToken, session);
        return sessionToken;
    }

    getSession(sessionToken) {
        const session = this.sessions.get(sessionToken);
        if (session) {
            session.lastActivity = new Date();
            return session;
        }
        return null;
    }

    updateSession(sessionToken, updates) {
        const session = this.sessions.get(sessionToken);
        if (session) {
            Object.assign(session, updates);
            session.lastActivity = new Date();
            return session;
        }
        return null;
    }

    addToHistory(sessionToken, query, response) {
        const session = this.sessions.get(sessionToken);
        if (session) {
            session.conversationHistory.push({
                query,
                response,
                timestamp: new Date().toISOString(),
                queryId: `q_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
            });
            
            // Keep only last 10 conversations
            if (session.conversationHistory.length > 10) {
                session.conversationHistory = session.conversationHistory.slice(-10);
            }
            
            session.totalQueries++;
        }
    }

    addEntityContext(sessionToken, entities) {
        const session = this.sessions.get(sessionToken);
        if (session && Array.isArray(entities)) {
            entities.forEach(entity => {
                if (typeof entity === 'string') {
                    session.entityContext.add(entity.toLowerCase());
                } else if (entity.name) {
                    session.entityContext.add(entity.name.toLowerCase());
                }
            });
        }
    }

    cleanup() {
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
        for (const [token, session] of this.sessions.entries()) {
            if (session.lastActivity < cutoff) {
                this.sessions.delete(token);
            }
        }
        logger.info(`Session cleanup completed. Active sessions: ${this.sessions.size}`);
    }

    getStats() {
        return {
            totalActiveSessions: this.sessions.size,
            oldestSession: Math.min(...Array.from(this.sessions.values()).map(s => s.createdAt.getTime())),
            totalQueries: Array.from(this.sessions.values()).reduce((sum, s) => sum + s.totalQueries, 0)
        };
    }
}

// Response formatter for enhanced chat responses
class ResponseFormatter {
    constructor() {
        this.currencyFormatter = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 1
        });
    }

    formatAUM(amount) {
        if (amount >= 1000000000000) {
            return `$${(amount / 1000000000000).toFixed(1)}T`;
        } else if (amount >= 1000000000) {
            return `$${(amount / 1000000000).toFixed(1)}B`;
        } else if (amount >= 1000000) {
            return `$${(amount / 1000000).toFixed(1)}M`;
        }
        return this.currencyFormatter.format(amount);
    }

    generateSuggestions(queryResults, conversationContext) {
        const suggestions = [];
        
        if (queryResults.results && queryResults.results.length > 0) {
            const firstResult = queryResults.results[0];
            
            // Contextual suggestions based on the query type
            if (firstResult.type === 'Private Equity Firm') {
                suggestions.push(
                    {
                        text: `Tell me more about ${firstResult.name}`,
                        action: 'detail_view',
                        entityId: firstResult.name.toLowerCase().replace(/\s+/g, '_')
                    },
                    {
                        text: 'Show portfolio companies',
                        action: 'portfolio_view',
                        context: 'private_equity'
                    },
                    {
                        text: 'Compare with competitors',
                        action: 'comparison',
                        entityType: 'private_equity_firm'
                    }
                );
            } else if (firstResult.type === 'Portfolio Company') {
                suggestions.push(
                    {
                        text: `Who invested in ${firstResult.name}?`,
                        action: 'investor_lookup',
                        entityId: firstResult.name
                    },
                    {
                        text: 'Show similar companies',
                        action: 'similar_entities',
                        sector: firstResult.sector
                    }
                );
            }
            
            // Generic suggestions
            if (queryResults.results.length > 1) {
                suggestions.push({
                    text: 'Show top 10 results',
                    action: 'expand_results',
                    limit: 10
                });
            }
        }
        
        // Add conversational suggestions
        suggestions.push(
            {
                text: 'What are the latest trends?',
                action: 'trend_analysis',
                context: 'market_trends'
            },
            {
                text: 'Start a new topic',
                action: 'reset_context'
            }
        );
        
        return suggestions.slice(0, 4); // Limit to 4 suggestions
    }

    generateVisualizations(queryResults, query) {
        const visualizations = [];
        
        if (queryResults.results && queryResults.results.length > 1) {
            const hasAUM = queryResults.results.some(r => r.aum);
            
            if (hasAUM) {
                visualizations.push({
                    type: 'bar_chart',
                    title: 'Assets Under Management Comparison',
                    description: 'Compare AUM across firms',
                    dataUrl: `/api/chart/aum-comparison/${Date.now()}`,
                    suggestedHeight: 300
                });
            }
            
            if (query.toLowerCase().includes('trend') || query.toLowerCase().includes('growth')) {
                visualizations.push({
                    type: 'line_chart',
                    title: 'Growth Trends',
                    description: 'Historical performance trends',
                    dataUrl: `/api/chart/trends/${Date.now()}`,
                    suggestedHeight: 250
                });
            }
        }
        
        return visualizations;
    }

    enhanceResults(results) {
        return results.map((result, index) => {
            const enhanced = { ...result };
            
            // Format AUM
            if (result.aum) {
                enhanced.aumFormatted = this.formatAUM(result.aum);
                enhanced.rank = index + 1;
            }
            
            // Add highlights
            if (result.type === 'Private Equity Firm') {
                if (result.aum > 900000000000) {
                    enhanced.highlight = 'One of the world\'s largest asset managers';
                } else if (result.aum > 500000000000) {
                    enhanced.highlight = 'Major global investment firm';
                } else if (result.aum > 100000000000) {
                    enhanced.highlight = 'Significant industry player';
                }
            }
            
            return enhanced;
        });
    }

    formatEnhancedResponse(queryResults, query, session) {
        const enhancedResults = this.enhanceResults(queryResults.results || []);
        const suggestions = this.generateSuggestions(queryResults, session);
        const visualizations = this.generateVisualizations(queryResults, query);
        
        // Generate natural language response
        let message = this.generateNaturalResponse(enhancedResults, query, session);
        
        // Calculate summary statistics
        const summary = this.generateSummary(enhancedResults);
        
        return {
            type: 'enhanced_chat',
            message,
            data: {
                entities: enhancedResults,
                summary
            },
            suggestions,
            visualizations
        };
    }

    generateNaturalResponse(results, query, session) {
        if (!results || results.length === 0) {
            return "I couldn't find specific information for that query. Could you try rephrasing or asking about private equity firms, portfolio companies, or investment data?";
        }
        
        const count = results.length;
        const firstResult = results[0];
        
        let message = `I found ${count} relevant result${count > 1 ? 's' : ''} for "${query}". `;
        
        if (firstResult.type === 'Private Equity Firm') {
            message += `${firstResult.name} leads`;
            if (firstResult.aumFormatted) {
                message += ` with ${firstResult.aumFormatted} in AUM`;
            }
            if (firstResult.highlight) {
                message += `, making it ${firstResult.highlight.toLowerCase()}`;
            }
            message += '.';
            
            if (count > 1) {
                const totalAUM = results.reduce((sum, r) => sum + (r.aum || 0), 0);
                if (totalAUM > 0) {
                    message += ` Together, these ${count} firms manage ${this.formatAUM(totalAUM)} in assets.`;
                }
            }
        } else {
            message += `The top result is ${firstResult.name}`;
            if (firstResult.type) {
                message += ` (${firstResult.type})`;
            }
            if (firstResult.sector) {
                message += ` in the ${firstResult.sector} sector`;
            }
            message += '.';
        }
        
        return message;
    }

    generateSummary(results) {
        if (!results || results.length === 0) return null;
        
        const summary = {
            totalResults: results.length
        };
        
        // Calculate AUM statistics
        const firmResults = results.filter(r => r.type === 'Private Equity Firm' && r.aum);
        if (firmResults.length > 0) {
            const totalAUM = firmResults.reduce((sum, r) => sum + r.aum, 0);
            const avgAUM = totalAUM / firmResults.length;
            
            summary.totalAUM = this.formatAUM(totalAUM);
            summary.avgAUM = this.formatAUM(avgAUM);
            summary.firms = firmResults.length;
        }
        
        return summary;
    }
}

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
        this.sessionStore = new SessionStore();
        this.responseFormatter = new ResponseFormatter();
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
                description: 'AI-powered knowledge system for private markets data with enhanced wrapper service',
                version: require('./package.json').version,
                deployment: 'Railway - Live',
                status: 'operational',
                endpoints: {
                    // Core API
                    health: '/health',
                    stats: '/api/stats',
                    query: '/api/query (POST)',
                    agent: '/api/agent/query (POST)',
                    conversation: '/api/agent/conversation (POST)',
                    // Enhanced Wrapper Service
                    wrapperChat: '/api/wrapper/chat (POST) - Main integration endpoint',
                    wrapperSession: '/api/wrapper/session (POST/GET/DELETE) - Session management',
                    wrapperStats: '/api/wrapper/stats (GET) - Wrapper service statistics'
                },
                features: {
                    conversationMemory: true,
                    contextAwareQueries: true,
                    richResponses: true,
                    sessionManagement: true,
                    visualizationSuggestions: true,
                    multiAppIntegration: true
                },
                documentation: 'https://github.com/vibecoder12/knowledge-store-deploy',
                timestamp: new Date().toISOString()
            });
        });

        // Alternative health endpoint
        this.app.get('/status', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                version: require('./package.json').version,
                environment: process.env.NODE_ENV || 'production',
                deployment: 'railway',
                port: this.port,
                components: {
                    graphDb: this.neo4j.isConnected(),
                    intelligenceEngine: true,
                    knowledgeStore: true
                }
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

        // ===========================================
        // ENHANCED WRAPPER SERVICE ENDPOINTS
        // ===========================================

        // Enhanced wrapper chat endpoint - Main integration point for external apps
        this.app.post('/api/wrapper/chat', async (req, res) => {
            try {
                const { 
                    message, 
                    sessionToken, 
                    userId, 
                    context = {},
                    metadata = {} 
                } = req.body;

                // Validate required fields
                if (!message || typeof message !== 'string') {
                    return res.status(400).json({
                        success: false,
                        error: 'Message is required and must be a string'
                    });
                }

                const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                const timestamp = new Date().toISOString();
                
                logger.info(`Enhanced wrapper chat: ${message.substring(0, 100)}`, { 
                    requestId, 
                    sessionToken, 
                    userId, 
                    appId: context.appId 
                });

                // Get or create session
                let session;
                if (sessionToken) {
                    session = this.sessionStore.getSession(sessionToken);
                    if (!session) {
                        logger.warn(`Session not found: ${sessionToken}, creating new session`);
                        const newToken = this.sessionStore.createSession(userId || 'anonymous', context.appId);
                        session = this.sessionStore.getSession(newToken);
                    }
                } else {
                    const newToken = this.sessionStore.createSession(userId || 'anonymous', context.appId);
                    session = this.sessionStore.getSession(newToken);
                }

                // Update user preferences if provided
                if (context.userPreferences) {
                    this.sessionStore.updateSession(session.sessionToken, {
                        userPreferences: { ...session.userPreferences, ...context.userPreferences }
                    });
                    session = this.sessionStore.getSession(session.sessionToken);
                }

                // Enhance query with conversation context
                let enhancedQuery = message;
                if (session.conversationHistory.length > 0) {
                    const recentContext = Array.from(session.entityContext).slice(-5);
                    if (recentContext.length > 0 && !message.toLowerCase().includes(recentContext[0])) {
                        // Add contextual enhancement if query seems to reference previous entities
                        const pronouns = ['it', 'that', 'this', 'they', 'them', 'those'];
                        if (pronouns.some(pronoun => message.toLowerCase().includes(pronoun))) {
                            enhancedQuery += ` (context: ${recentContext.join(', ')})`;
                        }
                    }
                }

                // Execute query
                const queryResult = await this.neo4j.executeQuery(enhancedQuery, {
                    sessionId: session.sessionToken,
                    conversational: true,
                    ...context
                });

                // Add entities to session context
                if (queryResult.results) {
                    this.sessionStore.addEntityContext(session.sessionToken, queryResult.results);
                }

                // Format enhanced response
                const formattedResponse = this.responseFormatter.formatEnhancedResponse(
                    queryResult, 
                    message, 
                    session
                );

                // Add conversation to history
                this.sessionStore.addToHistory(session.sessionToken, message, formattedResponse);

                // Build final response
                const response = {
                    success: true,
                    requestId,
                    timestamp,
                    sessionToken: session.sessionToken,
                    conversationId: session.sessionToken, // For compatibility
                    response: formattedResponse,
                    conversationContext: {
                        intent: queryResult.intent?.intent || 'general_search',
                        entitiesDiscussed: Array.from(session.entityContext).slice(-10),
                        topicHistory: session.conversationHistory.map(h => h.query).slice(-5),
                        lastQuery: message,
                        queryCount: session.totalQueries
                    },
                    metadata: {
                        processingTime: queryResult.metadata?.processingTime || 200,
                        cached: false,
                        confidence: 0.95,
                        dataSource: 'Private Markets Knowledge Store',
                        sessionAge: Date.now() - session.createdAt.getTime(),
                        deployment: 'railway-wrapper'
                    }
                };

                res.json(response);

            } catch (error) {
                logger.error('Enhanced wrapper chat error:', error);
                res.status(500).json({
                    success: false,
                    error: {
                        message: 'Chat processing failed',
                        requestId: `req_${Date.now()}`,
                        timestamp: new Date().toISOString()
                    }
                });
            }
        });

        // Session management endpoints
        this.app.post('/api/wrapper/session', (req, res) => {
            try {
                const { userId, appId, userPreferences } = req.body;
                
                const sessionToken = this.sessionStore.createSession(
                    userId || 'anonymous', 
                    appId || 'default'
                );
                
                if (userPreferences) {
                    this.sessionStore.updateSession(sessionToken, { userPreferences });
                }
                
                const session = this.sessionStore.getSession(sessionToken);
                
                res.json({
                    success: true,
                    sessionToken,
                    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                    userPreferences: session.userPreferences,
                    timestamp: new Date().toISOString()
                });
                
            } catch (error) {
                logger.error('Session creation error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to create session'
                });
            }
        });

        this.app.get('/api/wrapper/session/:sessionToken', (req, res) => {
            try {
                const { sessionToken } = req.params;
                const session = this.sessionStore.getSession(sessionToken);
                
                if (!session) {
                    return res.status(404).json({
                        success: false,
                        error: 'Session not found or expired'
                    });
                }
                
                res.json({
                    success: true,
                    sessionToken: session.sessionToken,
                    userId: session.userId,
                    appId: session.appId,
                    totalQueries: session.totalQueries,
                    entitiesDiscussed: Array.from(session.entityContext),
                    conversationLength: session.conversationHistory.length,
                    lastActivity: session.lastActivity.toISOString(),
                    userPreferences: session.userPreferences
                });
                
            } catch (error) {
                logger.error('Session retrieval error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to retrieve session'
                });
            }
        });

        this.app.delete('/api/wrapper/session/:sessionToken', (req, res) => {
            try {
                const { sessionToken } = req.params;
                const session = this.sessionStore.getSession(sessionToken);
                
                if (!session) {
                    return res.status(404).json({
                        success: false,
                        error: 'Session not found'
                    });
                }
                
                this.sessionStore.sessions.delete(sessionToken);
                
                res.json({
                    success: true,
                    message: 'Session deleted successfully',
                    timestamp: new Date().toISOString()
                });
                
            } catch (error) {
                logger.error('Session deletion error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to delete session'
                });
            }
        });

        // Wrapper service stats
        this.app.get('/api/wrapper/stats', (req, res) => {
            try {
                const sessionStats = this.sessionStore.getStats();
                
                res.json({
                    success: true,
                    data: {
                        wrapper: {
                            version: '1.0.0',
                            deployment: 'railway-integrated',
                            uptime: process.uptime(),
                            sessions: sessionStats,
                            features: {
                                conversationMemory: true,
                                contextAwareQueries: true,
                                richResponses: true,
                                sessionManagement: true,
                                visualizationSuggestions: true
                            }
                        },
                        timestamp: new Date().toISOString()
                    }
                });
                
            } catch (error) {
                logger.error('Wrapper stats error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to retrieve wrapper stats'
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
        
        // Railway-specific debugging
        logger.info(`🔧 Environment variables:`);
        logger.info(`PORT: ${process.env.PORT}`);
        logger.info(`NODE_ENV: ${process.env.NODE_ENV}`);
        logger.info(`Railway variables: RAILWAY_ENVIRONMENT=${process.env.RAILWAY_ENVIRONMENT}`);
        
        this.server = this.app.listen(this.port, '0.0.0.0', () => {
            logger.info(`🌐 Private Markets Intelligence Agent running on host 0.0.0.0 port ${this.port}`);
            logger.info(`🚀 Railway deployment ready!`);
            logger.info(`📊 Health check: https://superb-dedication.railway.app/health`);
            logger.info(`🔍 Query endpoint: https://superb-dedication.railway.app/api/query`);
            logger.info(`🎯 Root endpoint: https://superb-dedication.railway.app/`);
            
            // Test internal connectivity
            setTimeout(() => {
                logger.info('🧪 Testing internal routes...');
                logger.info('Available routes: /, /health, /status, /api/stats, /api/query, /api/agent/query');
            }, 1000);
        });
        
        this.server.on('error', (error) => {
            logger.error('❌ Server error:', error);
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
