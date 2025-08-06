/**
 * Private Markets Intelligence Agent
 * Main orchestrator for the intelligent agent system
 */

const { NLUEngine } = require('./NLUEngine');
const { QueryEngine } = require('./QueryEngine');
const { ResponseEngine } = require('./ResponseEngine');
const { ConversationManager } = require('./ConversationManager');

class PrivateMarketsAgent {
    constructor(config = {}) {
        // Configuration
        this.config = {
            logLevel: config.logLevel || 'info',
            enableDetailedLogging: config.enableDetailedLogging || false,
            maxResponseTime: config.maxResponseTime || 30000, // 30 seconds
            enableConversationAnalytics: config.enableConversationAnalytics !== false,
            ...config
        };

        // Core components
        this.nluEngine = new NLUEngine();
        this.queryEngine = new QueryEngine();
        this.responseEngine = new ResponseEngine();
        this.conversationManager = new ConversationManager();

        // Performance tracking
        this.stats = {
            totalQueries: 0,
            successfulQueries: 0,
            averageResponseTime: 0,
            topIntents: {},
            topEntities: {},
            startTime: new Date()
        };

        this.log('info', 'Private Markets Intelligence Agent initialized');
    }

    /**
     * Main query processing method
     */
    async processQuery(message, conversationId = null, user = null) {
        const startTime = Date.now();
        const queryId = this.generateQueryId();

        this.log('info', `Processing query ${queryId}: "${message}"`);

        try {
            // Get conversation context
            const context = conversationId ? 
                this.conversationManager.getContextForTurn(conversationId) : null;

            // Step 1: Natural Language Understanding
            const nluOutput = await this.nluEngine.processMessage(message, context);
            this.log('debug', `NLU completed for ${queryId}`, { nluOutput });

            // Update performance tracking
            this.updateStats('nlu', nluOutput);

            // Step 2: Query Generation and Execution
            const queryResults = await this.queryEngine.executeQuery(nluOutput, context);
            this.log('debug', `Query execution completed for ${queryId}`, { queryResults });

            // Step 3: Response Generation
            const response = await this.responseEngine.generateResponse(
                queryResults, 
                nluOutput, 
                context
            );
            this.log('debug', `Response generation completed for ${queryId}`, { response });

            // Step 4: Update conversation
            let turn = null;
            if (conversationId || this.config.enableConversationAnalytics) {
                const actualConversationId = conversationId || response.conversationId;
                turn = this.conversationManager.addTurn(
                    actualConversationId,
                    message,
                    response,
                    nluOutput,
                    queryResults
                );
            }

            // Step 5: Performance tracking and logging
            const executionTime = Date.now() - startTime;
            this.updatePerformanceStats(executionTime, !queryResults.error);
            
            // Create final response
            const finalResponse = {
                queryId,
                success: !queryResults.error,
                executionTime,
                timestamp: new Date().toISOString(),
                ...response,
                
                // Add conversation info if available
                ...(turn && {
                    conversation: {
                        id: turn.turnId ? conversationId : response.conversationId,
                        turnId: turn.turnId,
                        turnCount: this.conversationManager.getConversation(
                            conversationId || response.conversationId
                        ).turns.length
                    }
                }),

                // Add performance metadata
                performance: {
                    executionTime,
                    componentTiming: {
                        nlu: nluOutput.executionTime || null,
                        query: queryResults.metadata?.totalTime || null,
                        response: null // Would track this separately if needed
                    },
                    success: !queryResults.error
                }
            };

            this.log('info', `Query ${queryId} completed successfully in ${executionTime}ms`);
            return finalResponse;

        } catch (error) {
            const executionTime = Date.now() - startTime;
            this.log('error', `Query ${queryId} failed after ${executionTime}ms`, { 
                error: error.message,
                stack: error.stack
            });

            // Update error stats
            this.stats.totalQueries++;
            this.updatePerformanceStats(executionTime, false);

            return {
                queryId,
                success: false,
                executionTime,
                timestamp: new Date().toISOString(),
                error: {
                    message: error.message,
                    type: 'agent_error',
                    code: error.code || 'UNKNOWN_ERROR'
                },
                textualAnswer: "I apologize, but I encountered an unexpected error while processing your request. Please try again or contact support if the issue persists.",
                confidence: 0.0,
                followUpSuggestions: [
                    "Try rephrasing your question",
                    "Ask about a specific company or fund",
                    "Check if the entity names are spelled correctly"
                ]
            };
        }
    }

    /**
     * Get conversation history and analytics
     */
    getConversationInfo(conversationId) {
        if (!this.conversationManager.conversations.has(conversationId)) {
            return null;
        }

        const conversation = this.conversationManager.getConversation(conversationId);
        const context = this.conversationManager.getContextForTurn(conversationId);
        const patterns = this.conversationManager.analyzeConversationPatterns(conversationId);

        return {
            conversation: {
                id: conversation.id,
                createdAt: conversation.createdAt,
                lastActivity: conversation.lastActivity,
                turnCount: conversation.turns.length,
                duration: this.conversationManager.getSessionDuration(conversation)
            },
            context,
            patterns,
            suggestions: this.conversationManager.getHistoryBasedSuggestions(conversationId)
        };
    }

    /**
     * Get agent performance statistics
     */
    getAgentStatistics() {
        const conversationStats = this.conversationManager.getGlobalStatistics();
        const uptime = Date.now() - this.stats.startTime.getTime();

        return {
            agent: {
                uptime: Math.round(uptime / 1000), // seconds
                totalQueries: this.stats.totalQueries,
                successRate: this.stats.totalQueries > 0 ? 
                    (this.stats.successfulQueries / this.stats.totalQueries) * 100 : 100,
                averageResponseTime: this.stats.averageResponseTime,
                queriesPerMinute: this.stats.totalQueries / (uptime / 60000)
            },
            conversations: conversationStats,
            intents: {
                top: Object.entries(this.stats.topIntents)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 10)
                    .map(([intent, count]) => ({ intent, count }))
            },
            entities: {
                top: Object.entries(this.stats.topEntities)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 15)
                    .map(([entity, count]) => ({ entity, count }))
            }
        };
    }

    /**
     * Export conversation data
     */
    exportConversation(conversationId) {
        return this.conversationManager.exportConversation(conversationId);
    }

    /**
     * Get query suggestions for user
     */
    getSuggestions(conversationId = null) {
        if (conversationId) {
            return this.conversationManager.getHistoryBasedSuggestions(conversationId);
        }

        // Return generic suggestions
        return this.conversationManager.getGenericStarterSuggestions();
    }

    /**
     * Health check for agent components
     */
    async healthCheck() {
        const health = {
            timestamp: new Date().toISOString(),
            status: 'healthy',
            components: {},
            issues: []
        };

        try {
            // Check NLU Engine
            const nluTest = await this.nluEngine.processMessage("test query", null);
            health.components.nluEngine = nluTest ? 'healthy' : 'degraded';
        } catch (error) {
            health.components.nluEngine = 'unhealthy';
            health.issues.push(`NLU Engine: ${error.message}`);
        }

        try {
            // Check Query Engine (basic connectivity)
            health.components.queryEngine = 'healthy'; // Would test database connection
        } catch (error) {
            health.components.queryEngine = 'unhealthy';
            health.issues.push(`Query Engine: ${error.message}`);
        }

        // Check Response Engine
        health.components.responseEngine = 'healthy';

        // Check Conversation Manager
        health.components.conversationManager = 'healthy';

        // Overall status
        const unhealthyComponents = Object.values(health.components)
            .filter(status => status === 'unhealthy').length;
        
        if (unhealthyComponents > 0) {
            health.status = 'unhealthy';
        } else if (Object.values(health.components).includes('degraded')) {
            health.status = 'degraded';
        }

        return health;
    }

    /**
     * Update performance statistics
     */
    updatePerformanceStats(executionTime, success) {
        this.stats.totalQueries++;
        if (success) {
            this.stats.successfulQueries++;
        }

        // Update average response time
        if (this.stats.averageResponseTime === 0) {
            this.stats.averageResponseTime = executionTime;
        } else {
            this.stats.averageResponseTime = 
                (this.stats.averageResponseTime + executionTime) / 2;
        }
    }

    /**
     * Update tracking statistics
     */
    updateStats(component, data) {
        if (component === 'nlu' && data.intent) {
            const intent = data.intent.primary;
            this.stats.topIntents[intent] = (this.stats.topIntents[intent] || 0) + 1;

            // Track entities
            if (data.entities) {
                [...(data.entities.companies || []), ...(data.entities.people || [])]
                    .forEach(entity => {
                        this.stats.topEntities[entity.text] = 
                            (this.stats.topEntities[entity.text] || 0) + 1;
                    });
            }
        }
    }

    /**
     * Logging utility
     */
    log(level, message, data = null) {
        if (this.shouldLog(level)) {
            const timestamp = new Date().toISOString();
            const logEntry = {
                timestamp,
                level: level.toUpperCase(),
                component: 'PrivateMarketsAgent',
                message,
                ...(data && { data })
            };

            console.log(JSON.stringify(logEntry, null, 2));

            // In a production system, this would integrate with a proper logging service
        }
    }

    shouldLog(level) {
        const levels = { error: 0, warn: 1, info: 2, debug: 3 };
        const configLevel = levels[this.config.logLevel] || 2;
        const messageLevel = levels[level] || 2;
        
        return messageLevel <= configLevel;
    }

    /**
     * Generate unique query ID
     */
    generateQueryId() {
        return 'query_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    }

    /**
     * Shutdown cleanup
     */
    shutdown() {
        this.log('info', 'Shutting down Private Markets Intelligence Agent');
        
        // Clean up resources
        // In a production system, this would:
        // - Close database connections
        // - Save conversation state
        // - Cancel ongoing operations
        // - Clear intervals/timeouts
    }
}

module.exports = { PrivateMarketsAgent };
