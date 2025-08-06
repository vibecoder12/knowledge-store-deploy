/**
 * Concept Evolution System
 * Dynamically adds new concepts, entity types, and relationship patterns to the knowledge graph
 */

const winston = require('winston');
const { v4: uuidv4 } = require('uuid');

class ConceptEvolution {
    constructor(graphDb, config) {
        this.graphDb = graphDb;
        this.config = config;
        
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.simple(),
            defaultMeta: { service: 'concept-evolution' },
            transports: [new winston.transports.Console()]
        });

        // Track concept evolution
        this.conceptRegistry = new Map();
        this.evolutionHistory = [];
        this.conceptDetectionPatterns = new Map();
        
        this.initializeConceptDetection();
    }

    /**
     * Initialize concept detection patterns
     */
    initializeConceptDetection() {
        // Investment theme detection patterns
        this.addConceptDetectionPattern('INVESTMENT_THEMES', {
            keywords: ['ESG', 'sustainability', 'green', 'climate', 'renewable', 'impact', 'social', 'governance'],
            entityTypes: ['INVESTMENT_STRATEGY', 'SECTOR'],
            confidenceThreshold: 0.7,
            description: 'Detects emerging investment themes and ESG patterns'
        });

        // Technology trend patterns
        this.addConceptDetectionPattern('TECHNOLOGY_TRENDS', {
            keywords: ['AI', 'artificial intelligence', 'fintech', 'blockchain', 'cryptocurrency', 'digital', 'automation', 'robotics'],
            entityTypes: ['TECHNOLOGY', 'SECTOR'],
            confidenceThreshold: 0.6,
            description: 'Identifies technology-related investment trends'
        });

        // Geographic expansion patterns
        this.addConceptDetectionPattern('GEOGRAPHIC_EXPANSION', {
            keywords: ['emerging markets', 'asia-pacific', 'latin america', 'africa', 'middle east', 'expansion', 'international'],
            entityTypes: ['LOCATION', 'INVESTMENT_STRATEGY'],
            confidenceThreshold: 0.65,
            description: 'Tracks geographic expansion patterns and emerging markets'
        });

        // Regulatory changes
        this.addConceptDetectionPattern('REGULATORY_EVOLUTION', {
            keywords: ['regulation', 'compliance', 'policy', 'reform', 'regulatory change', 'legislation'],
            entityTypes: ['REGULATION', 'ASSET_CLASS'],
            confidenceThreshold: 0.8,
            description: 'Monitors regulatory changes affecting private markets'
        });

        // Market structure evolution
        this.addConceptDetectionPattern('MARKET_STRUCTURE', {
            keywords: ['consolidation', 'fragmentation', 'market structure', 'competition', 'merger', 'acquisition'],
            entityTypes: ['TRANSACTION', 'INVESTMENT_STRATEGY'],
            confidenceThreshold: 0.75,
            description: 'Identifies changes in market structure and competitive dynamics'
        });
    }

    /**
     * Add a new concept detection pattern
     */
    addConceptDetectionPattern(patternName, pattern) {
        this.conceptDetectionPatterns.set(patternName, {
            ...pattern,
            id: uuidv4(),
            createdAt: new Date(),
            detectionCount: 0,
            lastDetection: null
        });
        
        this.logger.info(`📋 Added concept detection pattern: ${patternName}`);
    }

    /**
     * Detect emerging concepts from entity data
     */
    async detectEmergingConcepts(entityData) {
        const detectedConcepts = [];
        
        for (const [patternName, pattern] of this.conceptDetectionPatterns.entries()) {
            const conceptDetection = await this.analyzeEntityForConcept(entityData, pattern);
            
            if (conceptDetection.confidence >= pattern.confidenceThreshold) {
                detectedConcepts.push({
                    patternName,
                    pattern: pattern.description,
                    confidence: conceptDetection.confidence,
                    evidence: conceptDetection.evidence,
                    suggestedEntityType: pattern.entityTypes[0],
                    suggestedRelationships: conceptDetection.relationships
                });

                // Update pattern statistics
                pattern.detectionCount++;
                pattern.lastDetection = new Date();
            }
        }

        return detectedConcepts;
    }

    /**
     * Analyze entity for specific concept pattern
     */
    async analyzeEntityForConcept(entityData, pattern) {
        const analysis = {
            confidence: 0,
            evidence: [],
            relationships: []
        };

        // Text analysis across entity properties
        const textFields = ['name', 'description', 'primaryServices', 'subType'];
        const entityText = textFields
            .map(field => entityData[field] || '')
            .join(' ')
            .toLowerCase();

        // Keyword matching
        let keywordMatches = 0;
        for (const keyword of pattern.keywords) {
            if (entityText.includes(keyword.toLowerCase())) {
                keywordMatches++;
                analysis.evidence.push(`Keyword match: "${keyword}"`);
            }
        }

        // Calculate confidence based on keyword density
        const keywordDensity = keywordMatches / pattern.keywords.length;
        analysis.confidence = Math.min(keywordDensity * 1.2, 0.95); // Max 95% confidence

        // Suggest relationships based on concept
        if (analysis.confidence >= pattern.confidenceThreshold) {
            analysis.relationships = this.suggestConceptRelationships(pattern, entityData);
        }

        return analysis;
    }

    /**
     * Suggest relationships for detected concepts
     */
    suggestConceptRelationships(pattern, entityData) {
        const relationships = [];

        // Pattern-specific relationship suggestions
        const patternRelationships = {
            'INVESTMENT_THEMES': ['FOLLOWS_ESG_STRATEGY', 'FOCUSES_ON_SUSTAINABILITY', 'IMPLEMENTS_IMPACT_INVESTING'],
            'TECHNOLOGY_TRENDS': ['ADOPTS_TECHNOLOGY', 'INVESTS_IN_FINTECH', 'FOCUSES_ON_DIGITAL_ASSETS'],
            'GEOGRAPHIC_EXPANSION': ['EXPANDS_TO_REGION', 'FOCUSES_ON_EMERGING_MARKETS', 'OPERATES_INTERNATIONALLY'],
            'REGULATORY_EVOLUTION': ['COMPLIES_WITH_REGULATION', 'AFFECTED_BY_POLICY', 'ADAPTS_TO_REGULATORY_CHANGE'],
            'MARKET_STRUCTURE': ['PARTICIPATES_IN_CONSOLIDATION', 'RESPONDS_TO_COMPETITION', 'ENGAGES_IN_M&A']
        };

        return patternRelationships[pattern.id] || ['RELATED_TO_CONCEPT'];
    }

    /**
     * Dynamically add new entity type to the system
     */
    async addNewEntityType(entityTypeName, entityTypeConfig) {
        const newEntityType = {
            id: uuidv4(),
            name: entityTypeName,
            description: entityTypeConfig.description,
            properties: entityTypeConfig.properties || [],
            relationships: entityTypeConfig.relationships || [],
            createdAt: new Date(),
            source: 'dynamic_evolution',
            examples: entityTypeConfig.examples || []
        };

        // Register the new entity type
        this.conceptRegistry.set(entityTypeName, newEntityType);

        // Update configuration (would typically persist to database)
        if (!this.config.intelligence.entityExtraction.entityTypes.includes(entityTypeName)) {
            this.config.intelligence.entityExtraction.entityTypes.push(entityTypeName);
        }

        // Create schema updates in graph database
        await this.createEntityTypeSchema(newEntityType);

        // Log evolution
        this.evolutionHistory.push({
            type: 'entity_type_addition',
            entityType: entityTypeName,
            timestamp: new Date(),
            reason: 'dynamic_concept_detection'
        });

        this.logger.info(`✅ Added new entity type: ${entityTypeName}`);
        return newEntityType;
    }

    /**
     * Dynamically add new relationship type
     */
    async addNewRelationshipType(relationshipTypeName, relationshipConfig) {
        const newRelationshipType = {
            id: uuidv4(),
            name: relationshipTypeName,
            description: relationshipConfig.description,
            fromEntityTypes: relationshipConfig.fromEntityTypes || [],
            toEntityTypes: relationshipConfig.toEntityTypes || [],
            properties: relationshipConfig.properties || [],
            createdAt: new Date(),
            source: 'dynamic_evolution'
        };

        // Register the new relationship type
        this.conceptRegistry.set(relationshipTypeName, newRelationshipType);

        // Update configuration
        if (!this.config.intelligence.relationshipInference.relationshipTypes.includes(relationshipTypeName)) {
            this.config.intelligence.relationshipInference.relationshipTypes.push(relationshipTypeName);
        }

        // Log evolution
        this.evolutionHistory.push({
            type: 'relationship_type_addition',
            relationshipType: relationshipTypeName,
            timestamp: new Date(),
            reason: 'dynamic_concept_detection'
        });

        this.logger.info(`✅ Added new relationship type: ${relationshipTypeName}`);
        return newRelationshipType;
    }

    /**
     * Create database schema for new entity type
     */
    async createEntityTypeSchema(entityType) {
        try {
            // Create constraints for the new entity type if it has unique properties
            if (entityType.properties.some(p => p.unique)) {
                const uniqueProperties = entityType.properties.filter(p => p.unique);
                
                for (const property of uniqueProperties) {
                    const constraintQuery = `
                        CREATE CONSTRAINT ${entityType.name.toLowerCase()}_${property.name}_unique 
                        IF NOT EXISTS 
                        FOR (n:${entityType.name}) 
                        REQUIRE n.${property.name} IS UNIQUE
                    `;
                    
                    try {
                        await this.graphDb.executeCustomQuery(constraintQuery);
                        this.logger.debug(`Created constraint for ${entityType.name}.${property.name}`);
                    } catch (error) {
                        this.logger.warn(`Could not create constraint: ${error.message}`);
                    }
                }
            }

            // Create indexes for searchable properties
            const searchableProperties = entityType.properties.filter(p => p.searchable);
            for (const property of searchableProperties) {
                const indexQuery = `
                    CREATE INDEX ${entityType.name.toLowerCase()}_${property.name}_index 
                    IF NOT EXISTS 
                    FOR (n:${entityType.name}) 
                    ON (n.${property.name})
                `;
                
                try {
                    await this.graphDb.executeCustomQuery(indexQuery);
                    this.logger.debug(`Created index for ${entityType.name}.${property.name}`);
                } catch (error) {
                    this.logger.warn(`Could not create index: ${error.message}`);
                }
            }

        } catch (error) {
            this.logger.error(`Error creating schema for ${entityType.name}:`, error);
        }
    }

    /**
     * Analyze system for concept gaps and suggestions
     */
    async analyzeConceptGaps() {
        const analysis = {
            missingConcepts: [],
            underrepresentedAreas: [],
            emergingPatterns: [],
            recommendations: []
        };

        try {
            // Analyze entity distribution
            const entityStats = await this.getEntityDistributionStats();
            
            // Identify underrepresented areas
            analysis.underrepresentedAreas = this.identifyUnderrepresentedAreas(entityStats);
            
            // Detect emerging patterns in recent data
            analysis.emergingPatterns = await this.detectEmergingPatterns();
            
            // Generate recommendations
            analysis.recommendations = this.generateConceptRecommendations(analysis);

            return analysis;

        } catch (error) {
            this.logger.error('Error analyzing concept gaps:', error);
            return analysis;
        }
    }

    /**
     * Get entity distribution statistics
     */
    async getEntityDistributionStats() {
        const query = `
            MATCH (e:Entity)
            RETURN e.type as entity_type, 
                   e.sector as sector,
                   e.country as country,
                   count(*) as count
            ORDER BY count DESC
        `;

        try {
            const result = await this.graphDb.executeCustomQuery(query);
            return result.records.map(record => ({
                entityType: record.entity_type,
                sector: record.sector,
                country: record.country,
                count: record.count
            }));
        } catch (error) {
            this.logger.warn('Could not get entity distribution stats:', error.message);
            return [];
        }
    }

    /**
     * Identify underrepresented areas in the knowledge graph
     */
    identifyUnderrepresentedAreas(entityStats) {
        const underrepresented = [];
        
        // Analyze by sector
        const sectorCounts = {};
        entityStats.forEach(stat => {
            if (stat.sector) {
                sectorCounts[stat.sector] = (sectorCounts[stat.sector] || 0) + stat.count;
            }
        });

        // Find sectors with low representation
        const totalEntities = Object.values(sectorCounts).reduce((a, b) => a + b, 0);
        Object.entries(sectorCounts).forEach(([sector, count]) => {
            const percentage = (count / totalEntities) * 100;
            if (percentage < 5) { // Less than 5% representation
                underrepresented.push({
                    area: sector,
                    type: 'sector',
                    currentCount: count,
                    percentage: percentage,
                    recommendation: `Consider expanding ${sector} coverage`
                });
            }
        });

        return underrepresented;
    }

    /**
     * Detect emerging patterns in recent data
     */
    async detectEmergingPatterns() {
        const patterns = [];
        
        // Analyze recent entity additions for patterns
        const recentEntitiesQuery = `
            MATCH (e:Entity)
            WHERE e.created > datetime() - duration({days: 30})
            RETURN e.type, e.sector, e.country, count(*) as recent_count
            ORDER BY recent_count DESC
            LIMIT 10
        `;

        try {
            const result = await this.graphDb.executeCustomQuery(recentEntitiesQuery);
            
            result.records.forEach(record => {
                if (record.recent_count > 5) { // Threshold for "emerging"
                    patterns.push({
                        pattern: `Growing interest in ${record.e.type} in ${record.e.sector || 'general'} sector`,
                        evidence: `${record.recent_count} new entities in last 30 days`,
                        confidence: Math.min(record.recent_count / 20, 0.95),
                        suggestedAction: 'Monitor for new relationship patterns and investment themes'
                    });
                }
            });

        } catch (error) {
            this.logger.warn('Could not detect emerging patterns:', error.message);
        }

        return patterns;
    }

    /**
     * Generate concept evolution recommendations
     */
    generateConceptRecommendations(analysis) {
        const recommendations = [];

        // Recommendations based on underrepresented areas
        analysis.underrepresentedAreas.forEach(area => {
            recommendations.push({
                type: 'entity_expansion',
                priority: 'medium',
                description: `Expand data coverage in ${area.area}`,
                action: `Add more ${area.type} entities and relationships`,
                expectedImpact: 'Improved query results and market coverage'
            });
        });

        // Recommendations based on emerging patterns
        analysis.emergingPatterns.forEach(pattern => {
            recommendations.push({
                type: 'pattern_monitoring',
                priority: 'high',
                description: pattern.pattern,
                action: 'Create specialized detection patterns and relationship types',
                expectedImpact: 'Better capture of emerging market trends'
            });
        });

        // General system improvement recommendations
        recommendations.push({
            type: 'system_enhancement',
            priority: 'low',
            description: 'Implement automated concept detection from external sources',
            action: 'Connect to news feeds, research reports, and market data APIs',
            expectedImpact: 'Continuous system evolution with minimal manual intervention'
        });

        return recommendations;
    }

    /**
     * Get concept evolution statistics
     */
    getEvolutionStats() {
        return {
            totalRegisteredConcepts: this.conceptRegistry.size,
            detectionPatterns: this.conceptDetectionPatterns.size,
            evolutionHistory: this.evolutionHistory.length,
            recentEvolutions: this.evolutionHistory.slice(-10),
            patternPerformance: Array.from(this.conceptDetectionPatterns.entries()).map(([name, pattern]) => ({
                name,
                detectionCount: pattern.detectionCount,
                lastDetection: pattern.lastDetection,
                description: pattern.description
            }))
        };
    }

    /**
     * Export current concept configuration for persistence
     */
    exportConceptConfiguration() {
        return {
            timestamp: new Date().toISOString(),
            entityTypes: this.config.intelligence.entityExtraction.entityTypes,
            relationshipTypes: this.config.intelligence.relationshipInference.relationshipTypes,
            conceptRegistry: Array.from(this.conceptRegistry.entries()),
            detectionPatterns: Array.from(this.conceptDetectionPatterns.entries()),
            evolutionHistory: this.evolutionHistory
        };
    }

    /**
     * Import concept configuration
     */
    importConceptConfiguration(configData) {
        try {
            // Update entity types
            this.config.intelligence.entityExtraction.entityTypes = configData.entityTypes || [];
            
            // Update relationship types
            this.config.intelligence.relationshipInference.relationshipTypes = configData.relationshipTypes || [];
            
            // Restore concept registry
            if (configData.conceptRegistry) {
                this.conceptRegistry = new Map(configData.conceptRegistry);
            }
            
            // Restore detection patterns
            if (configData.detectionPatterns) {
                this.conceptDetectionPatterns = new Map(configData.detectionPatterns);
            }
            
            // Restore evolution history
            this.evolutionHistory = configData.evolutionHistory || [];

            this.logger.info('✅ Concept configuration imported successfully');
            return true;

        } catch (error) {
            this.logger.error('Failed to import concept configuration:', error);
            return false;
        }
    }
}

module.exports = ConceptEvolution;
