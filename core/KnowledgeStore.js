/**
 * Private Markets Knowledge Store
 * Main orchestrator class that coordinates all knowledge operations
 */

const { v4: uuidv4 } = require('uuid');
const winston = require('winston');
const _ = require('lodash');
const neo4j = require('neo4j-driver');

class KnowledgeStore {
    constructor({ graphDb, intelligenceEngine, config }) {
        this.graphDb = graphDb;
        this.intelligenceEngine = intelligenceEngine;
        this.config = config;
        this.ready = false;
        
        this.logger = winston.createLogger({
            level: config.logging.level,
            format: winston.format.simple(),
            defaultMeta: { service: 'knowledge-store' },
            transports: [new winston.transports.Console()]
        });

        // Query cache
        this.queryCache = new Map();
        this.cacheStats = { hits: 0, misses: 0 };
    }

    async initialize() {
        try {
            this.logger.info('🔄 Initializing Knowledge Store...');

            // Verify dependencies
            if (!this.graphDb.isConnected()) {
                throw new Error('Graph database not connected');
            }

            if (!this.intelligenceEngine.isReady()) {
                throw new Error('Intelligence engine not ready');
            }

            // Initialize internal state
            this.entityTypes = this.config.intelligence.entityExtraction.entityTypes;
            this.relationshipTypes = this.config.intelligence.relationshipInference.relationshipTypes;

            this.ready = true;
            this.logger.info('✅ Knowledge Store initialized');

        } catch (error) {
            this.logger.error('❌ Failed to initialize Knowledge Store:', error);
            throw error;
        }
    }

    isReady() {
        return this.ready;
    }

    /**
     * Intelligent query interface - the main entry point for knowledge queries
     */
    async query(queryText, options = {}) {
        try {
            this.logger.info(`🔍 Processing query: "${queryText}"`);

            // Check cache first
            const cacheKey = this.getCacheKey(queryText, options);
            if (options.useCache !== false) {
                const cached = this.getFromCache(cacheKey);
                if (cached) {
                    this.cacheStats.hits++;
                    this.logger.debug('📋 Returning cached result');
                    return cached;
                }
            }

            // Parse and understand the query
            const queryIntent = await this.intelligenceEngine.parseQuery(queryText);
            this.logger.debug('Query intent:', queryIntent);

            // Generate and execute graph queries based on intent
            const graphQueries = await this.generateGraphQueries(queryIntent, options);
            const rawResults = await this.executeGraphQueries(graphQueries);

            // Apply intelligence processing to results
            const intelligentResults = await this.applyIntelligence(rawResults, queryIntent);

            // Format final response
            const response = {
                query: queryText,
                intent: queryIntent,
                results: intelligentResults.entities || [],
                relationships: intelligentResults.relationships || [],
                insights: intelligentResults.insights || [],
                patterns: intelligentResults.patterns || [],
                confidence: intelligentResults.confidence || 0.5,
                metadata: {
                    executionTime: Date.now() - (options.startTime || Date.now()),
                    resultsCount: intelligentResults.entities?.length || 0,
                    queryComplexity: queryIntent.complexity || 'medium',
                    sources: intelligentResults.sources || []
                }
            };

            // Cache the result
            if (options.useCache !== false) {
                this.setCache(cacheKey, response);
                this.cacheStats.misses++;
            }

            this.logger.info(`✅ Query completed: ${response.metadata.resultsCount} results`);
            return response;

        } catch (error) {
            this.logger.error('❌ Query failed:', error);
            throw error;
        }
    }

    /**
     * Add entities to the knowledge graph
     */
    async addEntity(entityData) {
        try {
            // Validate entity data
            if (!entityData.name || !entityData.type) {
                throw new Error('Entity must have name and type');
            }

            // Generate unique ID if not provided
            if (!entityData.id) {
                entityData.id = uuidv4();
            }

            // Normalize entity data
            const normalizedEntity = await this.normalizeEntityData(entityData);

            // Extract additional intelligence
            const enhancedEntity = await this.intelligenceEngine.enhanceEntity(normalizedEntity);

            // Store in graph database
            const storedEntity = await this.graphDb.createEntity(enhancedEntity);

            // Infer and create relationships
            await this.inferRelationships(storedEntity);

            this.logger.info(`✅ Added entity: ${storedEntity.name} (${storedEntity.type})`);
            return storedEntity;

        } catch (error) {
            this.logger.error('❌ Failed to add entity:', error);
            throw error;
        }
    }

    /**
     * Batch add multiple entities
     */
    async addEntities(entitiesData, options = {}) {
        const results = {
            successful: [],
            failed: [],
            relationships: []
        };

        const batchSize = options.batchSize || this.config.ingestion.batchSize;
        const batches = _.chunk(entitiesData, batchSize);

        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            this.logger.info(`📦 Processing batch ${i + 1}/${batches.length} (${batch.length} entities)`);

            const batchPromises = batch.map(async (entityData) => {
                try {
                    const entity = await this.addEntity(entityData);
                    results.successful.push(entity);
                } catch (error) {
                    results.failed.push({
                        entityData,
                        error: error.message
                    });
                }
            });

            await Promise.all(batchPromises);
        }

        // After all entities are added, perform batch relationship inference
        if (options.inferRelationships !== false) {
            this.logger.info('🔗 Inferring batch relationships...');
            const batchRelationships = await this.inferBatchRelationships(results.successful);
            results.relationships = batchRelationships;
        }

        this.logger.info(`✅ Batch completed: ${results.successful.length} successful, ${results.failed.length} failed`);
        return results;
    }

    /**
     * Find similar entities using multiple similarity algorithms
     */
    async findSimilarEntities(entityId, options = {}) {
        try {
            const similarity = options.similarity || 0.7;
            const limit = options.limit || 10;

            // Get graph-based similarity
            const graphSimilar = await this.graphDb.findSimilarEntities(entityId, similarity, limit);

            // Get semantic similarity if intelligence engine supports it
            let semanticSimilar = [];
            if (this.intelligenceEngine.findSemanticSimilarity) {
                semanticSimilar = await this.intelligenceEngine.findSemanticSimilarity(entityId, options);
            }

            // Combine and rank results
            const combinedResults = await this.combineAndRankSimilarity(graphSimilar, semanticSimilar);

            return {
                entity: entityId,
                similar: combinedResults,
                metadata: {
                    graphSimilarityCount: graphSimilar.length,
                    semanticSimilarityCount: semanticSimilar.length,
                    combinedCount: combinedResults.length
                }
            };

        } catch (error) {
            this.logger.error('❌ Failed to find similar entities:', error);
            throw error;
        }
    }

    /**
     * Discover patterns in the knowledge graph
     */
    async discoverPatterns(options = {}) {
        try {
            this.logger.info('🔍 Discovering patterns...');

            const patterns = {
                investment: await this.discoverInvestmentPatterns(options),
                behavioral: await this.discoverBehavioralPatterns(options),
                temporal: await this.discoverTemporalPatterns(options),
                geographical: await this.discoverGeographicalPatterns(options),
                sector: await this.discoverSectorPatterns(options)
            };

            // Rank patterns by significance
            const rankedPatterns = await this.rankPatterns(patterns);

            this.logger.info(`✅ Discovered ${rankedPatterns.length} patterns`);
            return rankedPatterns;

        } catch (error) {
            this.logger.error('❌ Failed to discover patterns:', error);
            throw error;
        }
    }

    /**
     * Get comprehensive market intelligence
     */
    async getMarketIntelligence(options = {}) {
        try {
            this.logger.info('📊 Generating market intelligence...');

            const intelligence = {
                overview: await this.getMarketOverview(),
                trends: await this.identifyMarketTrends(options),
                opportunities: await this.identifyOpportunities(options),
                risks: await this.identifyRisks(options),
                predictions: await this.generatePredictions(options),
                recommendations: await this.generateRecommendations(options)
            };

            return intelligence;

        } catch (error) {
            this.logger.error('❌ Failed to generate market intelligence:', error);
            throw error;
        }
    }

    /**
     * Get knowledge graph statistics
     */
    async getStats() {
        try {
            const graphStats = await this.graphDb.getGraphStats();
            
            return {
                ...graphStats,
                cache: {
                    size: this.queryCache.size,
                    hits: this.cacheStats.hits,
                    misses: this.cacheStats.misses,
                    hitRate: this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses) || 0
                },
                intelligence: this.intelligenceEngine.getStats ? await this.intelligenceEngine.getStats() : {},
                lastUpdated: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('❌ Failed to get stats:', error);
            throw error;
        }
    }

    // Private helper methods

    async generateGraphQueries(queryIntent, options) {
        const queries = [];

        if (queryIntent.entityTypes?.length > 0) {
            queries.push({
                type: 'entity_search',
                cypher: 'MATCH (e:Entity) WHERE e.type IN $entityTypes RETURN e LIMIT $limit',
                params: {
                    entityTypes: queryIntent.entityTypes,
                    limit: neo4j.int(Math.floor(options.limit || 100))
                }
            });
        }

        if (queryIntent.relationships?.length > 0) {
            queries.push({
                type: 'relationship_search',
                cypher: 'MATCH (a)-[r]-(b) WHERE type(r) IN $relationshipTypes RETURN a, r, b LIMIT $limit',
                params: {
                    relationshipTypes: queryIntent.relationships,
                    limit: neo4j.int(Math.floor(options.limit || 100))
                }
            });
        }

        if (queryIntent.keywords?.length > 0) {
            queries.push({
                type: 'keyword_search',
                cypher: 'MATCH (e:Entity) WHERE any(keyword IN $keywords WHERE e.name CONTAINS keyword OR e.description CONTAINS keyword) RETURN e LIMIT $limit',
                params: {
                    keywords: queryIntent.keywords,
                    limit: neo4j.int(Math.floor(options.limit || 100))
                }
            });
        }

        return queries;
    }

    async executeGraphQueries(queries) {
        const results = [];

        for (const query of queries) {
            try {
                const result = await this.graphDb.executeCustomQuery(query.cypher, query.params);
                results.push({
                    type: query.type,
                    ...result
                });
            } catch (error) {
                this.logger.warn(`Query failed: ${query.type}`, error);
            }
        }

        return results;
    }

    async applyIntelligence(rawResults, queryIntent) {
        // This would be implemented to apply various intelligence algorithms
        // For now, return a simplified structure
        const entities = [];
        const relationships = [];

        rawResults.forEach(result => {
            result.records.forEach(record => {
                if (record.e) entities.push(record.e);
                if (record.a && record.b) {
                    entities.push(record.a, record.b);
                    relationships.push({
                        from: record.a,
                        to: record.b,
                        relationship: record.r
                    });
                }
            });
        });

        return {
            entities: _.uniqBy(entities, 'id'),
            relationships,
            insights: await this.generateInsights(entities, relationships),
            patterns: await this.detectPatternsInResults(entities, relationships),
            confidence: this.calculateConfidence(entities, relationships, queryIntent)
        };
    }

    async normalizeEntityData(entityData) {
        const normalized = { ...entityData };

        // Normalize name
        if (this.config.ingestion.transformation.normalizeNames) {
            normalized.name = normalized.name?.trim();
        }

        // Parse currency values
        if (this.config.ingestion.transformation.parseCurrency && normalized.aum) {
            normalized.aum = this.parseCurrencyString(normalized.aum);
        }

        // Extract dates
        if (this.config.ingestion.transformation.extractDates && normalized.founded) {
            normalized.foundedDate = this.parseDate(normalized.founded);
        }

        return normalized;
    }

    async inferRelationships(entity) {
        // Implement relationship inference logic
        // This is a placeholder for complex relationship inference
        return [];
    }

    async inferBatchRelationships(entities) {
        // Implement batch relationship inference
        // This would analyze all entities together to find relationships
        return [];
    }

    parseCurrencyString(currencyStr) {
        if (typeof currencyStr !== 'string') return currencyStr;
        
        // Remove currency symbols and commas
        const cleaned = currencyStr.replace(/[\$,€£¥]/g, '').trim();
        
        // Handle billions, millions, etc.
        const multipliers = {
            'b': 1000000000,
            'billion': 1000000000,
            'm': 1000000,
            'million': 1000000,
            'k': 1000,
            'thousand': 1000
        };

        for (const [suffix, multiplier] of Object.entries(multipliers)) {
            if (cleaned.toLowerCase().includes(suffix)) {
                const number = parseFloat(cleaned.replace(new RegExp(suffix, 'gi'), ''));
                return number * multiplier;
            }
        }

        return parseFloat(cleaned) || 0;
    }

    parseDate(dateStr) {
        try {
            return new Date(dateStr).toISOString();
        } catch {
            return null;
        }
    }

    getCacheKey(query, options) {
        return `${query}:${JSON.stringify(options)}`;
    }

    getFromCache(key) {
        const cached = this.queryCache.get(key);
        if (cached && Date.now() - cached.timestamp < this.config.cache.queryResultsTTL * 1000) {
            return cached.data;
        }
        this.queryCache.delete(key);
        return null;
    }

    setCache(key, data) {
        if (this.queryCache.size >= this.config.cache.maxSize) {
            // Simple LRU: remove oldest entry
            const firstKey = this.queryCache.keys().next().value;
            this.queryCache.delete(firstKey);
        }
        
        this.queryCache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    async generateInsights(entities, relationships) {
        // Placeholder for insight generation
        return [];
    }

    async detectPatternsInResults(entities, relationships) {
        // Placeholder for pattern detection
        return [];
    }

    calculateConfidence(entities, relationships, queryIntent) {
        // Simple confidence calculation based on result completeness
        let confidence = 0.5;
        
        if (entities.length > 0) confidence += 0.2;
        if (relationships.length > 0) confidence += 0.2;
        if (queryIntent.keywords && entities.some(e => 
            queryIntent.keywords.some(k => e.name?.includes(k))
        )) {
            confidence += 0.1;
        }

        return Math.min(confidence, 1.0);
    }

    // Placeholder methods for pattern discovery and market intelligence
    async discoverInvestmentPatterns(options) { return []; }
    async discoverBehavioralPatterns(options) { return []; }
    async discoverTemporalPatterns(options) { return []; }
    async discoverGeographicalPatterns(options) { return []; }
    async discoverSectorPatterns(options) { return []; }
    async rankPatterns(patterns) { return []; }
    async getMarketOverview() { return {}; }
    async identifyMarketTrends(options) { return []; }
    async identifyOpportunities(options) { return []; }
    async identifyRisks(options) { return []; }
    async generatePredictions(options) { return []; }
    async generateRecommendations(options) { return []; }
    async combineAndRankSimilarity(graphSimilar, semanticSimilar) {
        return [...graphSimilar, ...semanticSimilar]
            .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
            .slice(0, 10);
    }
}

module.exports = KnowledgeStore;
