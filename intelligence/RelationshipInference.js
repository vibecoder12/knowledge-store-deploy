/**
 * Advanced Relationship Inference Engine
 * Discovers hidden connections and relationships between entities in the private markets
 */

const winston = require('winston');

class RelationshipInference {
    constructor(graphDb, sourceIntelligence, config) {
        this.graphDb = graphDb;
        this.sourceIntelligence = sourceIntelligence;
        this.config = config;
        
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.simple(),
            defaultMeta: { service: 'relationship-inference' },
            transports: [new winston.transports.Console()]
        });

        // Initialize inference patterns
        this.initializeInferencePatterns();
        
        // Cache for relationship patterns
        this.patternCache = new Map();
        this.inferenceCache = new Map();
    }

    /**
     * Initialize relationship inference patterns
     */
    initializeInferencePatterns() {
        this.inferencePatterns = {
            // Co-investment patterns
            CO_INVESTMENT: {
                pattern: 'investment_overlap',
                minConfidence: 0.7,
                description: 'Entities that frequently invest in similar assets',
                queryTemplate: `
                    MATCH (entity1:Entity)-[:INVESTS_IN]->(asset:Entity)<-[:INVESTS_IN]-(entity2:Entity)
                    WHERE entity1 <> entity2 AND entity1.type CONTAINS 'Fund' AND entity2.type CONTAINS 'Fund'
                    RETURN entity1, entity2, count(asset) as overlap_count
                    ORDER BY overlap_count DESC
                `
            },

            // Geographic clustering
            GEOGRAPHIC_CLUSTERING: {
                pattern: 'geographic_affinity',
                minConfidence: 0.6,
                description: 'Entities operating in same geographic regions',
                queryTemplate: `
                    MATCH (entity1:Entity), (entity2:Entity)
                    WHERE entity1 <> entity2 
                    AND entity1.country = entity2.country 
                    AND entity1.type CONTAINS 'Fund' AND entity2.type CONTAINS 'Fund'
                    RETURN entity1, entity2, entity1.country as common_geography
                `
            },

            // Sector focus alignment
            SECTOR_ALIGNMENT: {
                pattern: 'sector_focus',
                minConfidence: 0.65,
                description: 'Entities with similar sector focus',
                queryTemplate: `
                    MATCH (entity1:Entity), (entity2:Entity)
                    WHERE entity1 <> entity2 
                    AND entity1.sector = entity2.sector 
                    AND entity1.type CONTAINS 'Fund' AND entity2.type CONTAINS 'Fund'
                    RETURN entity1, entity2, entity1.sector as common_sector
                `
            },

            // Sequential investment patterns
            FOLLOW_ON_INVESTMENT: {
                pattern: 'sequential_investment',
                minConfidence: 0.8,
                description: 'One entity often invests after another',
                queryTemplate: `
                    MATCH (leader:Entity)-[r1:INVESTS_IN]->(asset:Entity)<-[r2:INVESTS_IN]-(follower:Entity)
                    WHERE leader <> follower 
                    AND r1.created < r2.created
                    RETURN leader, follower, count(*) as follow_count
                    ORDER BY follow_count DESC
                `
            },

            // People connections
            PEOPLE_NETWORK: {
                pattern: 'shared_personnel',
                minConfidence: 0.85,
                description: 'Entities sharing key personnel or board members',
                queryTemplate: `
                    MATCH (person:Entity)-[:WORKS_AT|BOARD_MEMBER]->(entity1:Entity)
                    MATCH (person)-[:WORKS_AT|BOARD_MEMBER]->(entity2:Entity)
                    WHERE entity1 <> entity2 AND person.type = 'Person'
                    RETURN entity1, entity2, collect(person.name) as shared_people
                `
            },

            // Parent-subsidiary relationships
            CORPORATE_STRUCTURE: {
                pattern: 'corporate_hierarchy',
                minConfidence: 0.9,
                description: 'Parent-subsidiary or affiliate relationships',
                queryTemplate: `
                    MATCH (parent:Entity), (subsidiary:Entity)
                    WHERE parent <> subsidiary
                    AND (subsidiary.name CONTAINS parent.name OR parent.name CONTAINS subsidiary.name)
                    AND parent.type CONTAINS 'Fund' AND subsidiary.type CONTAINS 'Fund'
                    RETURN parent, subsidiary, 'name_similarity' as evidence
                `
            },

            // Deal collaboration
            DEAL_COLLABORATION: {
                pattern: 'transaction_collaboration',
                minConfidence: 0.75,
                description: 'Entities frequently involved in same transactions',
                queryTemplate: `
                    MATCH (entity1:Entity)-[:PARTICIPATES_IN]->(transaction:Entity)<-[:PARTICIPATES_IN]-(entity2:Entity)
                    WHERE entity1 <> entity2 AND transaction.type = 'Transaction'
                    RETURN entity1, entity2, count(transaction) as collaboration_count
                    ORDER BY collaboration_count DESC
                `
            }
        };
    }

    /**
     * Infer all relationships for the knowledge graph
     */
    async inferAllRelationships(options = {}) {
        const results = {
            totalInferences: 0,
            successfulInferences: 0,
            failedInferences: 0,
            relationshipTypes: {},
            confidenceDistribution: {},
            processingTime: Date.now()
        };

        this.logger.info('🔍 Starting comprehensive relationship inference...');

        try {
            for (const [patternName, pattern] of Object.entries(this.inferencePatterns)) {
                this.logger.info(`📊 Processing ${patternName} pattern...`);
                
                const patternResults = await this.inferRelationshipsByPattern(patternName, options);
                
                results.totalInferences += patternResults.candidates.length;
                results.successfulInferences += patternResults.successful;
                results.failedInferences += patternResults.failed;
                
                // Track relationship types
                results.relationshipTypes[patternName] = patternResults.successful;
            }

            // Additional inference methods
            await this.inferByEntitySimilarity(results, options);
            await this.inferByTemporalPatterns(results, options);
            await this.inferByNetworkAnalysis(results, options);

            results.processingTime = Date.now() - results.processingTime;
            
            this.logger.info(`✅ Relationship inference complete: ${results.successfulInferences} relationships inferred`);
            return results;

        } catch (error) {
            this.logger.error('❌ Error during relationship inference:', error);
            throw error;
        }
    }

    /**
     * Infer relationships using a specific pattern
     */
    async inferRelationshipsByPattern(patternName, options = {}) {
        const pattern = this.inferencePatterns[patternName];
        if (!pattern) {
            throw new Error(`Unknown inference pattern: ${patternName}`);
        }

        const results = {
            pattern: patternName,
            candidates: [],
            successful: 0,
            failed: 0,
            relationships: []
        };

        try {
            // Execute the pattern query
            const queryResult = await this.graphDb.executeCustomQuery(pattern.queryTemplate);
            results.candidates = queryResult.records;

            // Process each candidate relationship
            for (const record of queryResult.records) {
                try {
                    const relationship = await this.processRelationshipCandidate(
                        record, 
                        patternName, 
                        pattern,
                        options
                    );

                    if (relationship && relationship.confidence >= pattern.minConfidence) {
                        // Create the relationship in the graph
                        await this.createInferredRelationship(relationship);
                        results.relationships.push(relationship);
                        results.successful++;
                    } else {
                        results.failed++;
                    }
                } catch (error) {
                    this.logger.warn(`Failed to process relationship candidate: ${error.message}`);
                    results.failed++;
                }
            }

        } catch (error) {
            this.logger.error(`Error processing pattern ${patternName}:`, error);
            throw error;
        }

        return results;
    }

    /**
     * Process a relationship candidate from pattern matching
     */
    async processRelationshipCandidate(record, patternName, pattern, options) {
        const entity1 = record.entity1 || record.parent || record.leader;
        const entity2 = record.entity2 || record.subsidiary || record.follower;

        if (!entity1 || !entity2) {
            return null;
        }

        // Calculate confidence based on evidence
        let confidence = pattern.minConfidence;
        const evidence = [];

        // Pattern-specific confidence calculation
        switch (patternName) {
            case 'CO_INVESTMENT':
                const overlapCount = record.overlap_count || 0;
                confidence = Math.min(0.95, 0.5 + (overlapCount * 0.1));
                evidence.push(`Co-invested in ${overlapCount} assets`);
                break;

            case 'GEOGRAPHIC_CLUSTERING':
                confidence = 0.6; // Base geographic affinity
                evidence.push(`Both operate in ${record.common_geography}`);
                break;

            case 'SECTOR_ALIGNMENT':
                confidence = 0.65; // Base sector alignment
                evidence.push(`Both focus on ${record.common_sector}`);
                break;

            case 'FOLLOW_ON_INVESTMENT':
                const followCount = record.follow_count || 0;
                confidence = Math.min(0.9, 0.6 + (followCount * 0.05));
                evidence.push(`${followCount} follow-on investments observed`);
                break;

            case 'PEOPLE_NETWORK':
                const sharedPeople = record.shared_people || [];
                confidence = Math.min(0.95, 0.7 + (sharedPeople.length * 0.05));
                evidence.push(`Share ${sharedPeople.length} key personnel`);
                break;

            case 'CORPORATE_STRUCTURE':
                confidence = 0.8; // High confidence for name similarity
                evidence.push('Corporate name similarity detected');
                break;

            case 'DEAL_COLLABORATION':
                const collabCount = record.collaboration_count || 0;
                confidence = Math.min(0.9, 0.5 + (collabCount * 0.08));
                evidence.push(`Collaborated on ${collabCount} transactions`);
                break;
        }

        // Create source information for the inference
        const sources = [{
            type: 'AI_INFERENCE',
            data: {
                pattern: patternName,
                evidence: evidence,
                confidence: confidence,
                timestamp: new Date()
            }
        }];

        // Create weighted relationship using source intelligence
        return this.sourceIntelligence.createWeightedRelationship(
            entity1,
            entity2,
            this.mapPatternToRelationshipType(patternName),
            sources
        );
    }

    /**
     * Map inference patterns to relationship types
     */
    mapPatternToRelationshipType(patternName) {
        const mappings = {
            'CO_INVESTMENT': 'CO_INVESTED',
            'GEOGRAPHIC_CLUSTERING': 'OPERATES_IN_SAME_REGION',
            'SECTOR_ALIGNMENT': 'FOCUSES_ON_SAME_SECTOR',
            'FOLLOW_ON_INVESTMENT': 'FOLLOWS_INVESTMENT_PATTERN',
            'PEOPLE_NETWORK': 'SHARES_PERSONNEL',
            'CORPORATE_STRUCTURE': 'AFFILIATED_WITH',
            'DEAL_COLLABORATION': 'COLLABORATES_ON_DEALS'
        };

        return mappings[patternName] || 'INFERRED_RELATIONSHIP';
    }

    /**
     * Create an inferred relationship in the graph database
     */
    async createInferredRelationship(relationship) {
        try {
            // Check if relationship already exists
            const existingQuery = `
                MATCH (from:Entity {id: $fromId})-[r]-(to:Entity {id: $toId})
                WHERE type(r) = $relationshipType
                RETURN r
            `;

            const existing = await this.graphDb.executeCustomQuery(existingQuery, {
                fromId: relationship.from.id,
                toId: relationship.to.id,
                relationshipType: relationship.type
            });

            if (existing.records.length > 0) {
                // Update existing relationship confidence if ours is higher
                const existingRel = existing.records[0].r;
                if (relationship.confidence > (existingRel.confidence || 0)) {
                    await this.updateRelationshipConfidence(existingRel, relationship);
                }
                return existingRel;
            }

            // Create new relationship
            return await this.graphDb.createRelationship(
                relationship.from.id,
                relationship.to.id,
                relationship.type,
                {
                    confidence: relationship.confidence,
                    sources: JSON.stringify(relationship.sources),
                    metadata: JSON.stringify(relationship.metadata),
                    inferredAt: new Date().toISOString(),
                    inferenceType: 'pattern_based'
                }
            );

        } catch (error) {
            this.logger.error('Failed to create inferred relationship:', error);
            throw error;
        }
    }

    /**
     * Update existing relationship confidence
     */
    async updateRelationshipConfidence(existingRel, newRelationship) {
        const updateQuery = `
            MATCH (from:Entity {id: $fromId})-[r]-(to:Entity {id: $toId})
            WHERE type(r) = $relationshipType
            SET r.confidence = $confidence,
                r.updated = datetime(),
                r.sources = $sources,
                r.metadata = $metadata
            RETURN r
        `;

        return await this.graphDb.executeCustomQuery(updateQuery, {
            fromId: newRelationship.from.id,
            toId: newRelationship.to.id,
            relationshipType: newRelationship.type,
            confidence: newRelationship.confidence,
            sources: JSON.stringify(newRelationship.sources),
            metadata: JSON.stringify(newRelationship.metadata)
        });
    }

    /**
     * Infer relationships by entity similarity
     */
    async inferByEntitySimilarity(results, options) {
        this.logger.info('🔍 Inferring relationships by entity similarity...');

        const similarityQuery = `
            MATCH (e1:Entity), (e2:Entity)
            WHERE e1 <> e2 
            AND e1.type = e2.type
            AND (
                e1.country = e2.country OR
                e1.sector = e2.sector OR
                e1.name CONTAINS e2.name OR
                e2.name CONTAINS e1.name
            )
            RETURN e1, e2, 
                CASE 
                    WHEN e1.country = e2.country THEN 1 ELSE 0 END as country_match,
                CASE 
                    WHEN e1.sector = e2.sector THEN 1 ELSE 0 END as sector_match,
                CASE 
                    WHEN e1.name CONTAINS e2.name OR e2.name CONTAINS e1.name THEN 1 ELSE 0 END as name_similarity
            LIMIT 1000
        `;

        try {
            const queryResult = await this.graphDb.executeCustomQuery(similarityQuery);
            let similarityInferences = 0;

            for (const record of queryResult.records) {
                const similarity_score = (record.country_match + record.sector_match + record.name_similarity) / 3.0;
                
                if (similarity_score >= 0.5) {
                    const sources = [{
                        type: 'AI_INFERENCE',
                        data: {
                            pattern: 'entity_similarity',
                            similarity_score: similarity_score,
                            evidence: [
                                record.country_match ? 'Same country' : null,
                                record.sector_match ? 'Same sector' : null,
                                record.name_similarity ? 'Name similarity' : null
                            ].filter(Boolean),
                            timestamp: new Date()
                        }
                    }];

                    const relationship = this.sourceIntelligence.createWeightedRelationship(
                        record.e1,
                        record.e2,
                        'SIMILAR_TO',
                        sources
                    );

                    if (relationship.confidence >= 0.5) {
                        await this.createInferredRelationship(relationship);
                        similarityInferences++;
                    }
                }
            }

            results.relationshipTypes['ENTITY_SIMILARITY'] = similarityInferences;
            results.successfulInferences += similarityInferences;
            this.logger.info(`✅ Created ${similarityInferences} similarity-based relationships`);

        } catch (error) {
            this.logger.error('Error in similarity inference:', error);
        }
    }

    /**
     * Infer relationships by temporal patterns
     */
    async inferByTemporalPatterns(results, options) {
        this.logger.info('🔍 Inferring relationships by temporal patterns...');
        
        // This would analyze temporal patterns in the data
        // For now, we'll implement a basic version
        
        results.relationshipTypes['TEMPORAL_PATTERNS'] = 0;
        this.logger.info('⏱️  Temporal pattern analysis completed');
    }

    /**
     * Infer relationships by network analysis
     */
    async inferByNetworkAnalysis(results, options) {
        this.logger.info('🔍 Inferring relationships by network analysis...');
        
        // This would perform advanced network analysis
        // For now, we'll implement a basic version
        
        results.relationshipTypes['NETWORK_ANALYSIS'] = 0;
        this.logger.info('🌐 Network analysis completed');
    }

    /**
     * Get relationship inference statistics
     */
    async getInferenceStats() {
        const stats = {
            totalPatterns: Object.keys(this.inferencePatterns).length,
            cacheSize: this.patternCache.size,
            recentInferences: await this.getRecentInferences(),
            confidenceDistribution: await this.getConfidenceDistribution()
        };

        return stats;
    }

    /**
     * Get recent inferences
     */
    async getRecentInferences() {
        const query = `
            MATCH ()-[r]->()
            WHERE r.inferredAt IS NOT NULL
            AND r.inferredAt > datetime() - duration({days: 7})
            RETURN type(r) as relationship_type, count(r) as count
            ORDER BY count DESC
            LIMIT 10
        `;

        try {
            const result = await this.graphDb.executeCustomQuery(query);
            return result.records.map(record => ({
                relationshipType: record.relationship_type,
                count: record.count
            }));
        } catch (error) {
            this.logger.warn('Could not get recent inferences:', error.message);
            return [];
        }
    }

    /**
     * Get confidence distribution of inferred relationships
     */
    async getConfidenceDistribution() {
        const query = `
            MATCH ()-[r]->()
            WHERE r.confidence IS NOT NULL AND r.inferredAt IS NOT NULL
            RETURN 
                CASE 
                    WHEN r.confidence >= 0.9 THEN 'High (0.9+)'
                    WHEN r.confidence >= 0.7 THEN 'Medium-High (0.7-0.9)'
                    WHEN r.confidence >= 0.5 THEN 'Medium (0.5-0.7)'
                    ELSE 'Low (<0.5)'
                END as confidence_bucket,
                count(r) as count
            ORDER BY confidence_bucket DESC
        `;

        try {
            const result = await this.graphDb.executeCustomQuery(query);
            return result.records.map(record => ({
                bucket: record.confidence_bucket,
                count: record.count
            }));
        } catch (error) {
            this.logger.warn('Could not get confidence distribution:', error.message);
            return [];
        }
    }
}

module.exports = RelationshipInference;
