/**
 * Configuration module for Private Markets Knowledge Store
 */

const path = require('path');

const config = {
    // Database configuration
    neo4j: {
        uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
        username: process.env.NEO4J_USERNAME || 'neo4j',
        password: process.env.NEO4J_PASSWORD || 'password',
        maxConnectionPoolSize: 50,
        connectionTimeout: 30000
    },

    // AI Services configuration
    ai: {
        openai: {
            apiKey: process.env.OPENAI_API_KEY,
            model: 'gpt-4-1106-preview',
            temperature: 0.1,
            maxTokens: 4000,
            rateLimit: parseInt(process.env.OPENAI_RATE_LIMIT) || 60
        },
        perplexity: {
            apiKey: process.env.PERPLEXITY_API_KEY,
            model: 'pplx-70b-online',
            rateLimit: parseInt(process.env.PERPLEXITY_RATE_LIMIT) || 30
        }
    },

    // Data source paths
    data: {
        seedDataPath: path.resolve(process.env.SEED_DATA_PATH || '../Deals Sample'),
        outputPath: path.resolve(process.env.OUTPUT_DATA_PATH || './data/output'),
        cachePath: path.resolve('./data/cache'),
        logsPath: path.resolve('./logs')
    },

    // Intelligence engine settings
    intelligence: {
        confidenceThreshold: parseFloat(process.env.CONFIDENCE_THRESHOLD) || 0.7,
        relationshipWeightDecay: parseFloat(process.env.RELATIONSHIP_WEIGHT_DECAY) || 0.95,
        patternDetectionMinSupport: parseFloat(process.env.PATTERN_DETECTION_MIN_SUPPORT) || 0.3,
        queryCacheTTL: parseInt(process.env.QUERY_CACHE_TTL) || 3600,
        
        // Entity extraction settings
        entityExtraction: {
            minConfidence: 0.8,
            maxEntitiesPerDocument: 50,
            entityTypes: [
                'COMPANY', 'FUND', 'PERSON', 'LOCATION', 'SECTOR', 'ASSET_CLASS',
                'TRANSACTION', 'INVESTMENT_STRATEGY', 'TECHNOLOGY', 'REGULATION'
            ]
        },

        // Relationship inference settings
        relationshipInference: {
            coOccurrenceThreshold: 0.3,
            temporalWindowDays: 365,
            strengthDecayFactor: 0.1,
            relationshipTypes: [
                'INVESTS_IN', 'PARTNERS_WITH', 'COMPETES_WITH', 'ACQUIRED_BY',
                'MANAGES', 'ADVISES', 'BOARD_MEMBER', 'ALUMNI_OF', 'CO_INVESTED',
                'FOLLOWS_STRATEGY', 'OPERATES_IN', 'FOCUSES_ON'
            ]
        },

        // Pattern detection settings
        patternDetection: {
            minPatternSupport: 0.05,
            maxPatternLength: 5,
            confidenceThreshold: 0.7,
            temporalPatterns: true,
            spatialPatterns: true,
            behavioralPatterns: true
        }
    },

    // API settings
    api: {
        port: parseInt(process.env.PORT) || 3000,
        rateLimit: {
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 1000, // limit each IP to 1000 requests per windowMs
            standardHeaders: true,
            legacyHeaders: false
        },
        cors: {
            origin: process.env.NODE_ENV === 'production' ? false : true,
            credentials: true
        }
    },

    // Logging configuration
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        maxFiles: 10,
        maxSize: '100MB',
        datePattern: 'YYYY-MM-DD',
        auditFile: './logs/audit.json'
    },

    // Performance and caching
    cache: {
        ttl: 3600, // 1 hour default TTL
        maxSize: 10000, // Maximum number of cached items
        queryResultsTTL: 1800, // 30 minutes for query results
        entityDataTTL: 7200, // 2 hours for entity data
        relationshipDataTTL: 3600 // 1 hour for relationship data
    },

    // Market mind modeling settings
    marketMind: {
        investorBehaviorModel: {
            learningRate: 0.01,
            memoryDecay: 0.95,
            adaptationThreshold: 0.1
        },
        trendDetection: {
            minObservations: 10,
            significanceLevel: 0.05,
            trendStrengthThreshold: 0.3
        },
        predictionEngine: {
            timeHorizonDays: [30, 90, 180, 365],
            confidenceIntervals: [0.68, 0.95, 0.99],
            modelUpdateFrequency: 'daily'
        }
    },

    // Data ingestion settings
    ingestion: {
        batchSize: 1000,
        maxRetries: 3,
        retryDelay: 1000,
        validation: {
            strictMode: false,
            requireKeyFields: ['name', 'type'],
            allowUnknownFields: true
        },
        transformation: {
            normalizeNames: true,
            extractDates: true,
            parseCurrency: true,
            resolveAliases: true
        }
    }
};

// Environment-specific overrides
if (process.env.NODE_ENV === 'production') {
    config.logging.level = 'warn';
    config.api.cors.origin = process.env.ALLOWED_ORIGINS?.split(',') || false;
    config.cache.ttl = 7200; // Longer cache in production
}

if (process.env.NODE_ENV === 'development') {
    config.logging.level = 'debug';
    config.intelligence.confidenceThreshold = 0.6; // Lower threshold for dev
}

if (process.env.NODE_ENV === 'test') {
    config.neo4j.uri = 'bolt://localhost:7688'; // Test database
    config.logging.level = 'error';
    config.cache.ttl = 60; // Short cache for tests
}

// Validation
function validateConfig() {
    const required = [
        'neo4j.uri',
        'neo4j.username', 
        'neo4j.password',
        'data.seedDataPath'
    ];

    const missing = required.filter(path => {
        const value = path.split('.').reduce((obj, key) => obj?.[key], config);
        return !value;
    });

    if (missing.length > 0) {
        throw new Error(`Missing required configuration: ${missing.join(', ')}`);
    }

    // Warn about missing optional but important configs
    const warnings = [];
    
    if (!config.ai.openai.apiKey) {
        warnings.push('OPENAI_API_KEY not set - AI features will be limited');
    }
    
    if (!config.ai.perplexity.apiKey) {
        warnings.push('PERPLEXITY_API_KEY not set - research capabilities will be limited');
    }

    warnings.forEach(warning => console.warn(`⚠️  ${warning}`));
}

// Validate on load
try {
    validateConfig();
} catch (error) {
    console.error('❌ Configuration validation failed:', error.message);
    process.exit(1);
}

module.exports = config;
