/**
 * Conversation Manager for Private Markets Intelligence Agent
 * Handles multi-turn conversations, context management, and conversation flow
 */

class ConversationManager {
    constructor() {
        this.conversations = new Map();
        this.contextWindow = 10; // Number of turns to maintain in context
        this.sessionTimeoutMinutes = 60;
        
        // Start cleanup interval
        this.startCleanupInterval();
    }

    /**
     * Create or retrieve conversation session
     */
    getConversation(conversationId) {
        if (!conversationId) {
            conversationId = this.generateConversationId();
        }

        if (!this.conversations.has(conversationId)) {
            this.conversations.set(conversationId, {
                id: conversationId,
                createdAt: new Date(),
                lastActivity: new Date(),
                turns: [],
                context: this.initializeContext(),
                user: null
            });
        }

        // Update last activity
        const conversation = this.conversations.get(conversationId);
        conversation.lastActivity = new Date();

        return conversation;
    }

    /**
     * Add a turn to the conversation
     */
    addTurn(conversationId, userMessage, agentResponse, nluOutput, queryResults) {
        const conversation = this.getConversation(conversationId);

        const turn = {
            turnId: conversation.turns.length + 1,
            timestamp: new Date(),
            userMessage,
            agentResponse,
            nluOutput,
            queryResults: this.sanitizeQueryResults(queryResults),
            executionTime: queryResults?.metadata?.totalTime || null
        };

        conversation.turns.push(turn);

        // Update conversation context
        this.updateContext(conversation, turn);

        // Trim conversation to context window
        if (conversation.turns.length > this.contextWindow) {
            conversation.turns = conversation.turns.slice(-this.contextWindow);
        }

        return turn;
    }

    /**
     * Get conversation context for the current turn
     */
    getContextForTurn(conversationId) {
        const conversation = this.getConversation(conversationId);
        
        return {
            conversationId: conversation.id,
            currentContext: conversation.context,
            recentTurns: conversation.turns.slice(-3), // Last 3 turns for immediate context
            conversationSummary: this.generateConversationSummary(conversation),
            sessionInfo: {
                turnCount: conversation.turns.length,
                duration: this.getSessionDuration(conversation),
                topics: conversation.context.topicsDiscussed
            }
        };
    }

    /**
     * Initialize conversation context
     */
    initializeContext() {
        return {
            // Entities and topics discussed
            entitiesDiscussed: new Set(),
            topicsDiscussed: new Set(),
            sectorsExplored: new Set(),
            geographiesExplored: new Set(),
            
            // User preferences and patterns
            userPreferences: {
                preferredResponseLength: 'medium',
                preferredDetailLevel: 'balanced',
                preferredVisualizationTypes: [],
                frequentQuestions: []
            },
            
            // Conversation state
            currentFocus: null, // Current entity or topic of focus
            analyticsDepth: 'standard',
            
            // Knowledge tracking
            knowledgeCovered: new Set(),
            gaps: new Set(),
            followUpOpportunities: [],
            
            // Performance metrics
            querySuccessRate: 1.0,
            averageResponseTime: null,
            userSatisfactionIndicators: {
                followUpRate: 0,
                explorationDepth: 0,
                sessionLength: 0
            }
        };
    }

    /**
     * Update conversation context based on the latest turn
     */
    updateContext(conversation, turn) {
        const context = conversation.context;
        const { nluOutput, queryResults, agentResponse } = turn;

        // Update entities discussed
        if (nluOutput.entities) {
            nluOutput.entities.companies?.forEach(e => context.entitiesDiscussed.add(e.text));
            nluOutput.entities.people?.forEach(e => context.entitiesDiscussed.add(e.text));
            nluOutput.entities.sectors?.forEach(e => context.sectorsExplored.add(e.text));
            nluOutput.entities.geographies?.forEach(e => context.geographiesExplored.add(e.text));
        }

        // Update topics discussed
        if (nluOutput.intent?.primary) {
            context.topicsDiscussed.add(nluOutput.intent.primary);
        }

        // Update current focus
        if (nluOutput.entities?.companies?.length > 0) {
            context.currentFocus = nluOutput.entities.companies[0].text;
        }

        // Update knowledge covered
        if (queryResults?.processedResults) {
            Object.keys(queryResults.processedResults).forEach(key => {
                context.knowledgeCovered.add(key);
            });
        }

        // Update follow-up opportunities
        if (agentResponse?.followUpSuggestions) {
            context.followUpOpportunities = agentResponse.followUpSuggestions.slice(0, 3);
        }

        // Update success metrics
        if (queryResults?.error) {
            context.querySuccessRate = Math.max(context.querySuccessRate - 0.1, 0);
        } else {
            context.querySuccessRate = Math.min(context.querySuccessRate + 0.05, 1.0);
        }

        // Update user satisfaction indicators
        this.updateSatisfactionIndicators(context, conversation);
    }

    /**
     * Update user satisfaction indicators
     */
    updateSatisfactionIndicators(context, conversation) {
        const indicators = context.userSatisfactionIndicators;
        const totalTurns = conversation.turns.length;

        // Calculate follow-up rate
        const followUps = conversation.turns.filter((turn, index) => {
            if (index === 0) return false;
            const prevTurn = conversation.turns[index - 1];
            return prevTurn.agentResponse?.followUpSuggestions?.some(suggestion =>
                turn.userMessage.toLowerCase().includes(suggestion.toLowerCase().slice(0, 10))
            );
        });
        indicators.followUpRate = followUps.length / Math.max(totalTurns - 1, 1);

        // Calculate exploration depth
        indicators.explorationDepth = context.topicsDiscussed.size / totalTurns;

        // Update session length
        indicators.sessionLength = this.getSessionDuration(conversation);
    }

    /**
     * Generate conversation summary
     */
    generateConversationSummary(conversation) {
        if (conversation.turns.length === 0) {
            return "New conversation session started.";
        }

        const context = conversation.context;
        const lastTurn = conversation.turns[conversation.turns.length - 1];

        let summary = `Conversation with ${conversation.turns.length} turn(s). `;

        if (context.entitiesDiscussed.size > 0) {
            const entities = Array.from(context.entitiesDiscussed).slice(0, 3);
            summary += `Discussing: ${entities.join(', ')}${context.entitiesDiscussed.size > 3 ? ' and others' : ''}. `;
        }

        if (context.topicsDiscussed.size > 0) {
            const topics = Array.from(context.topicsDiscussed).slice(0, 2);
            summary += `Topics: ${topics.join(', ')}${context.topicsDiscussed.size > 2 ? ' and more' : ''}. `;
        }

        if (context.currentFocus) {
            summary += `Current focus: ${context.currentFocus}. `;
        }

        return summary.trim();
    }

    /**
     * Get conversation history for entity
     */
    getEntityHistory(conversationId, entityName) {
        const conversation = this.conversations.get(conversationId);
        if (!conversation) return [];

        return conversation.turns.filter(turn => {
            const entities = turn.nluOutput?.entities || {};
            const allEntities = [
                ...(entities.companies || []),
                ...(entities.people || [])
            ].map(e => e.text.toLowerCase());

            return allEntities.includes(entityName.toLowerCase());
        });
    }

    /**
     * Get suggestions based on conversation history
     */
    getHistoryBasedSuggestions(conversationId) {
        const conversation = this.conversations.get(conversationId);
        if (!conversation || conversation.turns.length === 0) {
            return this.getGenericStarterSuggestions();
        }

        const context = conversation.context;
        const suggestions = [];

        // Suggest deep-diving into current focus
        if (context.currentFocus) {
            suggestions.push(`Analyze the performance of ${context.currentFocus}`);
            suggestions.push(`Show me the portfolio of ${context.currentFocus}`);
        }

        // Suggest exploring related entities
        if (context.entitiesDiscussed.size > 1) {
            const entities = Array.from(context.entitiesDiscussed).slice(0, 2);
            suggestions.push(`Compare ${entities[0]} and ${entities[1]}`);
        }

        // Suggest sector exploration
        if (context.sectorsExplored.size > 0) {
            const sector = Array.from(context.sectorsExplored)[0];
            suggestions.push(`Find opportunities in ${sector}`);
        }

        // Fill remaining suggestions with generic ones
        const remainingSlots = 4 - suggestions.length;
        if (remainingSlots > 0) {
            const generic = this.getGenericStarterSuggestions();
            suggestions.push(...generic.slice(0, remainingSlots));
        }

        return suggestions.slice(0, 4);
    }

    getGenericStarterSuggestions() {
        return [
            "Tell me about Blackstone",
            "Find opportunities in technology",
            "Compare KKR and Apollo",
            "Show me the top private equity firms",
            "What are the latest trends in real estate investing?",
            "Find co-investment opportunities"
        ];
    }

    /**
     * Analyze conversation patterns for improvements
     */
    analyzeConversationPatterns(conversationId) {
        const conversation = this.conversations.get(conversationId);
        if (!conversation) return null;

        const analysis = {
            conversationId,
            metrics: {
                totalTurns: conversation.turns.length,
                duration: this.getSessionDuration(conversation),
                entitiesExplored: conversation.context.entitiesDiscussed.size,
                topicsExplored: conversation.context.topicsDiscussed.size,
                querySuccessRate: conversation.context.querySuccessRate,
                followUpEngagement: conversation.context.userSatisfactionIndicators.followUpRate
            },
            patterns: {
                preferredQueryTypes: this.getPreferredQueryTypes(conversation),
                entityFocusAreas: Array.from(conversation.context.entitiesDiscussed).slice(0, 5),
                topicProgression: this.getTopicProgression(conversation),
                sessionEngagement: this.calculateEngagementScore(conversation)
            },
            recommendations: this.generateConversationRecommendations(conversation)
        };

        return analysis;
    }

    getPreferredQueryTypes(conversation) {
        const intentCounts = {};
        conversation.turns.forEach(turn => {
            const intent = turn.nluOutput?.intent?.primary;
            if (intent) {
                intentCounts[intent] = (intentCounts[intent] || 0) + 1;
            }
        });

        return Object.entries(intentCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3)
            .map(([intent, count]) => ({ intent, count }));
    }

    getTopicProgression(conversation) {
        return conversation.turns.map((turn, index) => ({
            turn: index + 1,
            intent: turn.nluOutput?.intent?.primary,
            entities: [
                ...(turn.nluOutput?.entities?.companies || []).map(c => c.text),
                ...(turn.nluOutput?.entities?.people || []).map(p => p.text)
            ].slice(0, 2),
            timestamp: turn.timestamp
        }));
    }

    calculateEngagementScore(conversation) {
        const context = conversation.context;
        const indicators = context.userSatisfactionIndicators;

        // Weighted engagement score
        const weights = {
            followUpRate: 0.3,
            explorationDepth: 0.25,
            sessionLength: 0.2,
            querySuccess: 0.15,
            topicDiversity: 0.1
        };

        const scores = {
            followUpRate: indicators.followUpRate,
            explorationDepth: Math.min(indicators.explorationDepth, 1.0),
            sessionLength: Math.min(indicators.sessionLength / 30, 1.0), // Normalize to 30 minutes
            querySuccess: context.querySuccessRate,
            topicDiversity: Math.min(context.topicsDiscussed.size / 5, 1.0) // Normalize to 5 topics
        };

        const engagementScore = Object.entries(weights).reduce((total, [metric, weight]) => {
            return total + (scores[metric] * weight);
        }, 0);

        return Math.round(engagementScore * 100) / 100; // Round to 2 decimal places
    }

    generateConversationRecommendations(conversation) {
        const recommendations = [];
        const context = conversation.context;

        // Low success rate recommendations
        if (context.querySuccessRate < 0.7) {
            recommendations.push({
                type: 'query_optimization',
                message: 'Consider providing more specific entity names or using alternative search terms',
                priority: 'high'
            });
        }

        // Low engagement recommendations
        if (context.userSatisfactionIndicators.followUpRate < 0.2) {
            recommendations.push({
                type: 'engagement',
                message: 'Try exploring the suggested follow-up questions to discover more insights',
                priority: 'medium'
            });
        }

        // Exploration recommendations
        if (context.topicsDiscussed.size < 3 && conversation.turns.length > 5) {
            recommendations.push({
                type: 'exploration',
                message: 'Consider exploring different types of analysis beyond your current focus area',
                priority: 'low'
            });
        }

        return recommendations;
    }

    /**
     * Get session duration in minutes
     */
    getSessionDuration(conversation) {
        if (conversation.turns.length === 0) return 0;
        
        const start = conversation.createdAt;
        const end = conversation.lastActivity;
        return Math.round((end - start) / (1000 * 60)); // Minutes
    }

    /**
     * Clean up expired conversations
     */
    startCleanupInterval() {
        setInterval(() => {
            const now = new Date();
            const expiredThreshold = this.sessionTimeoutMinutes * 60 * 1000; // Convert to milliseconds

            for (const [conversationId, conversation] of this.conversations) {
                if (now - conversation.lastActivity > expiredThreshold) {
                    console.log(`Cleaning up expired conversation: ${conversationId}`);
                    this.conversations.delete(conversationId);
                }
            }
        }, 15 * 60 * 1000); // Run every 15 minutes
    }

    /**
     * Sanitize query results for storage
     */
    sanitizeQueryResults(queryResults) {
        if (!queryResults) return null;

        return {
            hasError: !!queryResults.error,
            recordCounts: queryResults.executionResults ? 
                Object.keys(queryResults.executionResults).reduce((counts, key) => {
                    counts[key] = queryResults.executionResults[key].recordCount || 0;
                    return counts;
                }, {}) : {},
            executionTime: queryResults.metadata?.totalTime || null,
            queryPlanSummary: queryResults.queryPlan?.summary || null
        };
    }

    /**
     * Generate conversation ID
     */
    generateConversationId() {
        return 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Get conversation statistics
     */
    getGlobalStatistics() {
        const stats = {
            totalConversations: this.conversations.size,
            activeConversations: 0,
            totalTurns: 0,
            averageSessionLength: 0,
            topIntents: {},
            topEntities: {}
        };

        let totalSessionTime = 0;

        for (const conversation of this.conversations.values()) {
            const sessionAge = Date.now() - conversation.lastActivity.getTime();
            if (sessionAge < this.sessionTimeoutMinutes * 60 * 1000) {
                stats.activeConversations++;
            }

            stats.totalTurns += conversation.turns.length;
            totalSessionTime += this.getSessionDuration(conversation);

            // Count intents
            conversation.turns.forEach(turn => {
                const intent = turn.nluOutput?.intent?.primary;
                if (intent) {
                    stats.topIntents[intent] = (stats.topIntents[intent] || 0) + 1;
                }
            });

            // Count entities
            conversation.context.entitiesDiscussed.forEach(entity => {
                stats.topEntities[entity] = (stats.topEntities[entity] || 0) + 1;
            });
        }

        stats.averageSessionLength = stats.totalConversations > 0 ? 
            Math.round(totalSessionTime / stats.totalConversations) : 0;

        // Sort and limit top items
        stats.topIntents = Object.entries(stats.topIntents)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});

        stats.topEntities = Object.entries(stats.topEntities)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 20)
            .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});

        return stats;
    }

    /**
     * Export conversation for analysis
     */
    exportConversation(conversationId) {
        const conversation = this.conversations.get(conversationId);
        if (!conversation) return null;

        return {
            id: conversation.id,
            createdAt: conversation.createdAt,
            lastActivity: conversation.lastActivity,
            duration: this.getSessionDuration(conversation),
            turnCount: conversation.turns.length,
            turns: conversation.turns.map(turn => ({
                turnId: turn.turnId,
                timestamp: turn.timestamp,
                userMessage: turn.userMessage,
                intent: turn.nluOutput?.intent?.primary,
                entities: {
                    companies: turn.nluOutput?.entities?.companies?.map(c => c.text) || [],
                    people: turn.nluOutput?.entities?.people?.map(p => p.text) || []
                },
                querySuccess: !turn.queryResults?.hasError,
                executionTime: turn.executionTime,
                responseLength: turn.agentResponse?.textualAnswer?.length || 0
            })),
            context: {
                entitiesDiscussed: Array.from(conversation.context.entitiesDiscussed),
                topicsDiscussed: Array.from(conversation.context.topicsDiscussed),
                sectorsExplored: Array.from(conversation.context.sectorsExplored),
                querySuccessRate: conversation.context.querySuccessRate,
                satisfactionIndicators: conversation.context.userSatisfactionIndicators
            }
        };
    }
}

module.exports = { ConversationManager };
