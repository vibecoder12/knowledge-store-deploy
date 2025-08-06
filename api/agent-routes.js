/**
 * Private Markets Intelligence Agent API Routes
 * Enhanced endpoints for natural language processing and conversation management
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const { PrivateMarketsAgent } = require('../agent/core/PrivateMarketsAgent');

const router = express.Router();

// Rate limiting for agent queries
const agentRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  }
});

class AgentAPIRoutes {
  constructor(knowledgeStore) {
    this.knowledgeStore = knowledgeStore;
    this.agent = new PrivateMarketsAgent({
      logLevel: process.env.LOG_LEVEL || 'info',
      enableDetailedLogging: process.env.NODE_ENV === 'development',
      enableConversationAnalytics: true
    });
    
    // Connect agent to knowledge store
    this.agent.queryEngine.knowledgeStore = knowledgeStore;
    
    this.setupRoutes();
  }

  setupRoutes() {
    // Natural Language Query Endpoint
    router.post('/query',
      agentRateLimit,
      body('query').isString().isLength({ min: 1, max: 500 }).trim(),
      body('conversationId').optional().isString(),
      body('context').optional().isObject(),
      this.handleQuery.bind(this)
    );

    // Conversation Management
    router.get('/conversation/:conversationId',
      this.getConversation.bind(this)
    );

    router.get('/conversations',
      this.listConversations.bind(this)
    );

    router.delete('/conversation/:conversationId',
      this.deleteConversation.bind(this)
    );

    // Agent Analytics
    router.get('/analytics',
      this.getAnalytics.bind(this)
    );

    // Agent Health & Statistics
    router.get('/health',
      this.getAgentHealth.bind(this)
    );

    // Batch Processing
    router.post('/batch',
      agentRateLimit,
      body('queries').isArray({ min: 1, max: 10 }),
      body('queries.*.query').isString().isLength({ min: 1, max: 500 }),
      this.handleBatch.bind(this)
    );

    return router;
  }

  async handleQuery(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { query, conversationId, context } = req.body;
      const userAgent = req.get('User-Agent');
      const clientIP = req.ip;

      console.log(`🔍 Processing query: "${query}" from ${clientIP}`);

      const startTime = Date.now();
      const result = await this.agent.processQuery(query, conversationId, {
        userAgent,
        clientIP,
        context
      });
      const processingTime = Date.now() - startTime;

      // Enhanced response format
      const response = {
        success: result.success,
        query: query,
        conversationId: result.conversationId,
        answer: result.textualAnswer,
        confidence: result.confidence,
        intent: result.contextUpdate?.lastIntent,
        entities: result.contextUpdate?.entitiesDiscussed || [],
        followUpSuggestions: result.followUpSuggestions || [],
        insights: result.insights || [],
        data: {
          recordsFound: result.structuredData?.recordCounts?.total || 0,
          executionResults: result.structuredData?.executionResults || {},
          processedResults: result.structuredData?.processedResults || {}
        },
        metadata: {
          processingTime: processingTime,
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      res.json(response);

    } catch (error) {
      console.error('❌ Query processing error:', error);
      next(error);
    }
  }

  async getConversation(req, res, next) {
    try {
      const { conversationId } = req.params;
      const conversationInfo = this.agent.getConversationInfo(conversationId);
      
      if (!conversationInfo) {
        return res.status(404).json({
          error: 'Conversation not found',
          conversationId
        });
      }

      res.json({
        conversationId,
        ...conversationInfo,
        metadata: {
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      next(error);
    }
  }

  async listConversations(req, res, next) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const agentStats = this.agent.getAgentStatistics();
      
      // Get conversation summaries
      const conversations = agentStats.conversations?.recent || [];
      
      const startIndex = (page - 1) * limit;
      const paginatedConversations = conversations.slice(startIndex, startIndex + limit);

      res.json({
        conversations: paginatedConversations,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(conversations.length / limit),
          totalConversations: conversations.length,
          limit: parseInt(limit)
        },
        metadata: {
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      next(error);
    }
  }

  async deleteConversation(req, res, next) {
    try {
      const { conversationId } = req.params;
      const deleted = this.agent.deleteConversation(conversationId);
      
      if (!deleted) {
        return res.status(404).json({
          error: 'Conversation not found',
          conversationId
        });
      }

      res.json({
        success: true,
        message: 'Conversation deleted successfully',
        conversationId
      });

    } catch (error) {
      next(error);
    }
  }

  async getAnalytics(req, res, next) {
    try {
      const stats = this.agent.getAgentStatistics();
      
      res.json({
        agent: stats.agent,
        queries: stats.queries,
        entities: stats.entities,
        conversations: stats.conversations,
        performance: stats.performance,
        metadata: {
          timestamp: new Date().toISOString(),
          uptime: process.uptime()
        }
      });

    } catch (error) {
      next(error);
    }
  }

  async getAgentHealth(req, res, next) {
    try {
      const health = {
        status: 'healthy',
        components: {
          agent: this.agent ? 'healthy' : 'unhealthy',
          knowledgeStore: this.knowledgeStore?.isReady() || false,
          graphDatabase: this.knowledgeStore?.graphDb?.isConnected() || false,
          intelligenceEngine: this.knowledgeStore?.intelligenceEngine?.isReady() || false
        },
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
      };

      const allHealthy = Object.values(health.components).every(status => status === true || status === 'healthy');
      health.status = allHealthy ? 'healthy' : 'degraded';

      res.status(allHealthy ? 200 : 503).json(health);

    } catch (error) {
      res.status(500).json({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  async handleBatch(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { queries } = req.body;
      const results = [];

      console.log(`🔄 Processing batch of ${queries.length} queries`);

      for (let i = 0; i < queries.length; i++) {
        try {
          const queryItem = queries[i];
          const startTime = Date.now();
          
          const result = await this.agent.processQuery(
            queryItem.query,
            queryItem.conversationId,
            { batchIndex: i }
          );
          
          results.push({
            index: i,
            query: queryItem.query,
            success: true,
            result: {
              answer: result.textualAnswer,
              confidence: result.confidence,
              intent: result.contextUpdate?.lastIntent,
              recordsFound: result.structuredData?.recordCounts?.total || 0
            },
            processingTime: Date.now() - startTime
          });

        } catch (error) {
          results.push({
            index: i,
            query: queries[i].query,
            success: false,
            error: error.message,
            processingTime: 0
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const totalProcessingTime = results.reduce((sum, r) => sum + r.processingTime, 0);

      res.json({
        batchId: `batch_${Date.now()}`,
        summary: {
          totalQueries: queries.length,
          successful: successCount,
          failed: queries.length - successCount,
          totalProcessingTime,
          averageProcessingTime: totalProcessingTime / queries.length
        },
        results,
        metadata: {
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      next(error);
    }
  }
}

module.exports = (knowledgeStore) => {
  const agentRoutes = new AgentAPIRoutes(knowledgeStore);
  return agentRoutes.setupRoutes();
};
