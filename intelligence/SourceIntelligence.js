/**
 * Source Intelligence System
 * Manages source credibility, weighting, and cross-validation for the knowledge store
 */

const winston = require('winston');

class SourceIntelligence {
    constructor(config) {
        this.config = config;
        this.sourceRegistry = new Map();
        this.validationCache = new Map();
        
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.simple(),
            defaultMeta: { service: 'source-intelligence' },
            transports: [new winston.transports.Console()]
        });

        // Initialize source authority levels
        this.initializeSourceAuthority();
    }

    /**
     * Initialize source authority hierarchy
     */
    initializeSourceAuthority() {
        // Primary sources (highest authority)
        this.registerSourceType('SEC_FILINGS', {
            authority: 0.95,
            category: 'regulatory',
            reliability: 0.98,
            timeliness: 0.85,
            verificationRequired: false
        });

        this.registerSourceType('COMPANY_ANNOUNCEMENTS', {
            authority: 0.90,
            category: 'official',
            reliability: 0.95,
            timeliness: 0.95,
            verificationRequired: false
        });

        this.registerSourceType('FUND_REPORTS', {
            authority: 0.88,
            category: 'official',
            reliability: 0.92,
            timeliness: 0.80,
            verificationRequired: false
        });

        // Secondary sources (medium authority)
        this.registerSourceType('INDUSTRY_DATABASES', {
            authority: 0.80,
            category: 'industry',
            reliability: 0.85,
            timeliness: 0.90,
            verificationRequired: true
        });

        this.registerSourceType('EXPERT_ANALYSIS', {
            authority: 0.75,
            category: 'analysis',
            reliability: 0.80,
            timeliness: 0.85,
            verificationRequired: true
        });

        this.registerSourceType('FINANCIAL_MEDIA', {
            authority: 0.70,
            category: 'media',
            reliability: 0.75,
            timeliness: 0.95,
            verificationRequired: true
        });

        // Tertiary sources (lower authority)
        this.registerSourceType('NEWS_REPORTS', {
            authority: 0.60,
            category: 'news',
            reliability: 0.70,
            timeliness: 0.95,
            verificationRequired: true
        });

        this.registerSourceType('MARKET_RUMORS', {
            authority: 0.30,
            category: 'rumor',
            reliability: 0.40,
            timeliness: 0.98,
            verificationRequired: true
        });

        // Internal generated sources
        this.registerSourceType('AI_INFERENCE', {
            authority: 0.65,
            category: 'generated',
            reliability: 0.70,
            timeliness: 1.0,
            verificationRequired: true
        });
    }

    /**
     * Register a new source type
     */
    registerSourceType(sourceType, properties) {
        this.sourceRegistry.set(sourceType, {
            ...properties,
            registeredAt: new Date(),
            validationCount: 0,
            successRate: 0.5, // Initial neutral success rate
            recentPerformance: []
        });
    }

    /**
     * Get source authority score
     */
    getSourceAuthority(sourceType, sourceId = null) {
        const sourceConfig = this.sourceRegistry.get(sourceType);
        if (!sourceConfig) {
            this.logger.warn(`Unknown source type: ${sourceType}`);
            return 0.5; // Default neutral score
        }

        // Base authority
        let authority = sourceConfig.authority;

        // Adjust based on historical performance
        if (sourceConfig.recentPerformance.length > 0) {
            const recentAvg = sourceConfig.recentPerformance.reduce((a, b) => a + b, 0) / sourceConfig.recentPerformance.length;
            authority = (authority * 0.7) + (recentAvg * 0.3); // 70% base, 30% performance
        }

        // Time decay for non-official sources
        if (sourceConfig.category !== 'official' && sourceConfig.category !== 'regulatory') {
            const ageDecay = this.calculateTimeDecay(sourceConfig.registeredAt);
            authority *= ageDecay;
        }

        return Math.min(Math.max(authority, 0.1), 0.98); // Clamp between 0.1 and 0.98
    }

    /**
     * Calculate time decay factor
     */
    calculateTimeDecay(timestamp) {
        const daysSince = (Date.now() - timestamp.getTime()) / (1000 * 60 * 60 * 24);
        const halfLife = 30; // 30 days half-life for authority decay
        return Math.pow(0.5, daysSince / halfLife);
    }

    /**
     * Cross-validate information from multiple sources
     */
    async crossValidateInformation(information, sources) {
        const validationKey = this.generateValidationKey(information);
        
        // Check cache first
        if (this.validationCache.has(validationKey)) {
            return this.validationCache.get(validationKey);
        }

        const validation = {
            confidence: 0,
            sourceCount: sources.length,
            agreementLevel: 0,
            conflictingInfo: [],
            supportingInfo: [],
            recommendedAuthority: 0
        };

        // Calculate cross-validation score
        if (sources.length === 1) {
            validation.confidence = this.getSourceAuthority(sources[0].type);
            validation.recommendedAuthority = validation.confidence;
        } else {
            // Multiple source validation
            let totalWeight = 0;
            let weightedAgreement = 0;

            for (const source of sources) {
                const authority = this.getSourceAuthority(source.type);
                totalWeight += authority;
                
                if (source.agreement) {
                    weightedAgreement += authority;
                    validation.supportingInfo.push({
                        source: source.type,
                        authority,
                        information: source.data
                    });
                } else {
                    validation.conflictingInfo.push({
                        source: source.type,
                        authority,
                        information: source.data
                    });
                }
            }

            validation.agreementLevel = weightedAgreement / totalWeight;
            validation.confidence = validation.agreementLevel;
            validation.recommendedAuthority = totalWeight / sources.length;

            // Boost confidence for high-agreement multi-source validation
            if (validation.agreementLevel > 0.8 && sources.length >= 3) {
                validation.confidence = Math.min(validation.confidence * 1.2, 0.95);
            }
        }

        // Cache the validation result
        this.validationCache.set(validationKey, validation);
        return validation;
    }

    /**
     * Generate validation key for caching
     */
    generateValidationKey(information) {
        const infoString = typeof information === 'object' 
            ? JSON.stringify(information) 
            : information.toString();
        
        // Simple hash function
        let hash = 0;
        for (let i = 0; i < infoString.length; i++) {
            const char = infoString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return `validation_${Math.abs(hash)}`;
    }

    /**
     * Update source performance based on validation results
     */
    updateSourcePerformance(sourceType, validationSuccess, actualAccuracy = null) {
        const sourceConfig = this.sourceRegistry.get(sourceType);
        if (!sourceConfig) return;

        sourceConfig.validationCount++;
        
        // Update recent performance (keep last 10 validations)
        const performanceScore = actualAccuracy !== null ? actualAccuracy : (validationSuccess ? 1.0 : 0.0);
        sourceConfig.recentPerformance.push(performanceScore);
        
        if (sourceConfig.recentPerformance.length > 10) {
            sourceConfig.recentPerformance.shift(); // Remove oldest
        }

        // Update success rate
        const successCount = sourceConfig.recentPerformance.filter(p => p >= 0.7).length;
        sourceConfig.successRate = successCount / sourceConfig.recentPerformance.length;

        this.logger.debug(`Updated performance for ${sourceType}: ${sourceConfig.successRate.toFixed(3)}`);
    }

    /**
     * Get recommended sources for a query type
     */
    getRecommendedSources(queryType, entityType = null) {
        const recommendations = [];

        // Query-specific source recommendations
        const querySourceMap = {
            'TRANSACTION_LOOKUP': ['SEC_FILINGS', 'COMPANY_ANNOUNCEMENTS', 'INDUSTRY_DATABASES'],
            'FUND_INFORMATION': ['FUND_REPORTS', 'SEC_FILINGS', 'INDUSTRY_DATABASES'],
            'MARKET_TRENDS': ['EXPERT_ANALYSIS', 'INDUSTRY_DATABASES', 'FINANCIAL_MEDIA'],
            'COMPANY_DETAILS': ['SEC_FILINGS', 'COMPANY_ANNOUNCEMENTS', 'INDUSTRY_DATABASES'],
            'RELATIONSHIP_MAPPING': ['SEC_FILINGS', 'INDUSTRY_DATABASES', 'AI_INFERENCE']
        };

        const sourcesToCheck = querySourceMap[queryType] || Array.from(this.sourceRegistry.keys());

        for (const sourceType of sourcesToCheck) {
            const authority = this.getSourceAuthority(sourceType);
            const sourceConfig = this.sourceRegistry.get(sourceType);
            
            recommendations.push({
                sourceType,
                authority,
                reliability: sourceConfig.reliability,
                timeliness: sourceConfig.timeliness,
                category: sourceConfig.category,
                verificationRequired: sourceConfig.verificationRequired,
                successRate: sourceConfig.successRate
            });
        }

        // Sort by authority score
        return recommendations.sort((a, b) => b.authority - a.authority);
    }

    /**
     * Create source-weighted entity relationship
     */
    createWeightedRelationship(fromEntity, toEntity, relationshipType, sources) {
        const relationship = {
            from: fromEntity,
            to: toEntity,
            type: relationshipType,
            confidence: 0,
            sources: [],
            validatedAt: new Date(),
            metadata: {}
        };

        let totalWeight = 0;
        for (const source of sources) {
            const authority = this.getSourceAuthority(source.type);
            totalWeight += authority;
            
            relationship.sources.push({
                type: source.type,
                authority,
                data: source.data,
                timestamp: source.timestamp || new Date()
            });
        }

        relationship.confidence = Math.min(totalWeight / sources.length, 0.95);
        
        // Add metadata based on source analysis
        relationship.metadata = {
            sourceCount: sources.length,
            averageAuthority: totalWeight / sources.length,
            hasOfficialSource: sources.some(s => this.sourceRegistry.get(s.type)?.category === 'official'),
            hasRegulatorySource: sources.some(s => this.sourceRegistry.get(s.type)?.category === 'regulatory'),
            requiresVerification: sources.some(s => this.sourceRegistry.get(s.type)?.verificationRequired)
        };

        return relationship;
    }

    /**
     * Get source intelligence statistics
     */
    getIntelligenceStats() {
        const stats = {
            totalSourceTypes: this.sourceRegistry.size,
            validationCacheSize: this.validationCache.size,
            sourceBreakdown: {},
            topPerformingSources: [],
            lowPerformingSources: []
        };

        // Analyze source performance
        const sourcePerformances = [];
        
        for (const [sourceType, config] of this.sourceRegistry.entries()) {
            stats.sourceBreakdown[config.category] = (stats.sourceBreakdown[config.category] || 0) + 1;
            
            if (config.validationCount > 0) {
                sourcePerformances.push({
                    sourceType,
                    authority: config.authority,
                    successRate: config.successRate,
                    validationCount: config.validationCount
                });
            }
        }

        // Top and bottom performers
        sourcePerformances.sort((a, b) => b.successRate - a.successRate);
        stats.topPerformingSources = sourcePerformances.slice(0, 3);
        stats.lowPerformingSources = sourcePerformances.slice(-3).reverse();

        return stats;
    }
}

module.exports = SourceIntelligence;
