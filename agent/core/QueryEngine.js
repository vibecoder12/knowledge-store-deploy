/**
 * Query Intelligence Engine for Private Markets Intelligence Agent
 * Translates natural language intents into graph database queries
 */

// Knowledge store integration
const path = require('path');
const { GraphDatabase } = require('../../core/GraphDatabase');
const { KnowledgeStore } = require('../../core/KnowledgeStore');
const config = require('../../config/config');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

class QueryEngine {
    constructor(knowledgeStore = null) {
        this.knowledgeStore = knowledgeStore;
        this.graphDb = null; // Will be set by test or actual database connection
        this.queryBuilders = new Map();
        this.resultProcessors = new Map();
        
        this.initializeQueryBuilders();
        this.initializeResultProcessors();
    }

    /**
     * Execute query based on NLU output (main entry point)
     */
    async executeQuery(nluOutput, context = null) {
        return await this.processQuery(nluOutput, context);
    }

    /**
     * Process a structured NLU input and execute appropriate queries
     */
    async processQuery(nluOutput, context = null) {
        try {
            const queryPlan = await this.createQueryPlan(nluOutput);
            const executionResults = await this.executeQueryPlan(queryPlan);
            const processedResults = await this.processResults(executionResults, nluOutput);

            return {
                queryPlan,
                executionResults,
                processedResults,
                metadata: {
                    executionTime: Date.now() - nluOutput.timestamp,
                    complexity: nluOutput.complexity,
                    confidence: nluOutput.confidence
                }
            };
        } catch (error) {
            console.error('Query processing error:', error);
            return {
                error: error.message,
                fallback: await this.generateFallbackResponse(nluOutput)
            };
        }
    }

    async createQueryPlan(nluOutput) {
        const { intent, entities } = nluOutput;
        const intentKey = intent.primary;
        
        const queryBuilder = this.queryBuilders.get(intentKey);
        if (!queryBuilder) {
            throw new Error(`No query builder found for intent: ${intentKey}`);
        }

        return await queryBuilder.build(entities, nluOutput.context);
    }

    async executeQueryPlan(queryPlan) {
        const results = {};
        const executor = this.graphDb || this.knowledgeStore;
        
        if (!executor) {
            throw new Error('No database connection available (graphDb or knowledgeStore)');
        }

        for (const [queryName, queryData] of Object.entries(queryPlan.queries)) {
            try {
                const startTime = Date.now();
                const result = await executor.executeCustomQuery(
                    queryData.cypher,
                    queryData.parameters
                );
                
                results[queryName] = {
                    ...result,
                    executionTime: Date.now() - startTime,
                    recordCount: result.records ? result.records.length : 0
                };
            } catch (error) {
                results[queryName] = {
                    error: error.message,
                    executionTime: 0,
                    recordCount: 0
                };
            }
        }

        return results;
    }

    async processResults(executionResults, nluOutput) {
        const intentKey = nluOutput.intent.primary;
        const processor = this.resultProcessors.get(intentKey);
        
        if (!processor) {
            // Generic result processing
            return this.genericResultProcessing(executionResults);
        }

        return await processor.process(executionResults, nluOutput);
    }

    initializeQueryBuilders() {
        // Entity Information Queries
        this.queryBuilders.set('query.entity.info', new EntityInfoQueryBuilder());
        
        // Relationship Exploration
        this.queryBuilders.set('query.relationship.explore', new RelationshipQueryBuilder());
        
        // Portfolio Analysis
        this.queryBuilders.set('query.portfolio.analyze', new PortfolioQueryBuilder());
        
        // Performance Analysis
        this.queryBuilders.set('analyze.performance', new PerformanceQueryBuilder());
        
        // Market Trends
        this.queryBuilders.set('analyze.market.trends', new TrendsQueryBuilder());
        
        // Comparison
        this.queryBuilders.set('compare.entities', new ComparisonQueryBuilder());
        
        // Discovery
        this.queryBuilders.set('discover.opportunities', new DiscoveryQueryBuilder());
        
        // Network Exploration
        this.queryBuilders.set('explore.networks', new NetworkQueryBuilder());
    }

    initializeResultProcessors() {
        // Entity Information Processing
        this.resultProcessors.set('query.entity.info', new EntityInfoProcessor());
        
        // Relationship Processing
        this.resultProcessors.set('query.relationship.explore', new RelationshipProcessor());
        
        // Portfolio Processing
        this.resultProcessors.set('query.portfolio.analyze', new PortfolioProcessor());
        
        // Performance Processing
        this.resultProcessors.set('analyze.performance', new PerformanceProcessor());
        
        // Trends Processing
        this.resultProcessors.set('analyze.market.trends', new TrendsProcessor());
        
        // Comparison Processing
        this.resultProcessors.set('compare.entities', new ComparisonProcessor());
    }

    genericResultProcessing(executionResults) {
        const processed = {
            summary: {},
            details: {},
            insights: [],
            visualizations: []
        };

        for (const [queryName, queryResult] of Object.entries(executionResults)) {
            if (queryResult.error) {
                processed.summary[queryName] = { error: queryResult.error };
                continue;
            }

            processed.details[queryName] = queryResult.records;
            processed.summary[queryName] = {
                recordCount: queryResult.recordCount,
                executionTime: queryResult.executionTime
            };
        }

        return processed;
    }

    async generateFallbackResponse(nluOutput) {
        return {
            text: "I understand you're asking about private markets, but I need a bit more context to provide the most accurate information. Could you rephrase your question or provide more specific details?",
            suggestions: [
                "Tell me about a specific company or fund",
                "Ask about investment performance or trends",
                "Explore relationships between entities",
                "Compare different investments or strategies"
            ]
        };
    }
}

// Query Builder Classes
class EntityInfoQueryBuilder {
    async build(entities, context) {
        const queries = {};
        
        // Find companies mentioned
        if (entities.companies.length > 0) {
            const companyNames = entities.companies.map(c => c.text);
            queries.entityInfo = {
                cypher: `
                    MATCH (e:Entity) 
                    WHERE e.name IN $companyNames OR e.normalizedName IN $companyNames
                    OPTIONAL MATCH (e)-[r]->(related:Entity)
                    RETURN e, type(r) as relationshipType, related
                    LIMIT 50
                `,
                parameters: { companyNames }
            };
        }

        // Find people mentioned
        if (entities.people.length > 0) {
            const peopleNames = entities.people.map(p => p.text);
            queries.peopleInfo = {
                cypher: `
                    MATCH (p:Person)
                    WHERE p.name IN $peopleNames
                    OPTIONAL MATCH (p)-[r]->(e:Entity)
                    RETURN p, type(r) as relationshipType, e
                    LIMIT 50
                `,
                parameters: { peopleNames }
            };
        }

        return { queries, intent: 'entity_info' };
    }
}

class RelationshipQueryBuilder {
    async build(entities, context) {
        const queries = {};

        if (entities.companies.length >= 2) {
            // Multi-entity relationship exploration
            const companyNames = entities.companies.map(c => c.text);
            queries.relationships = {
                cypher: `
                    MATCH (e1:Entity), (e2:Entity)
                    WHERE e1.name IN $companyNames AND e2.name IN $companyNames AND e1 <> e2
                    MATCH path = (e1)-[*1..3]-(e2)
                    RETURN path, length(path) as pathLength
                    ORDER BY pathLength ASC
                    LIMIT 20
                `,
                parameters: { companyNames }
            };
        } else if (entities.companies.length === 1) {
            // Single entity relationship exploration
            const companyName = entities.companies[0].text;
            queries.entityNetwork = {
                cypher: `
                    MATCH (e:Entity {name: $companyName})-[r]-(related)
                    RETURN e, type(r) as relationshipType, related, r.confidence as confidence
                    ORDER BY r.confidence DESC, r.weight DESC
                    LIMIT 30
                `,
                parameters: { companyName }
            };
        }

        return { queries, intent: 'relationship_exploration' };
    }
}

class PortfolioQueryBuilder {
    async build(entities, context) {
        const queries = {};

        if (entities.companies.length > 0) {
            const companyNames = entities.companies.map(c => c.text);
            queries.portfolio = {
                cypher: `
                    MATCH (fund:Entity)-[:INVESTED_IN]->(company:Entity)
                    WHERE fund.name IN $companyNames OR company.name IN $companyNames
                    OPTIONAL MATCH (fund)-[:INVESTED_IN]->(otherCompany:Entity)
                    WHERE otherCompany <> company
                    RETURN fund, company, collect(DISTINCT otherCompany.name)[0..10] as otherInvestments
                    LIMIT 25
                `,
                parameters: { companyNames }
            };
        }

        return { queries, intent: 'portfolio_analysis' };
    }
}

class PerformanceQueryBuilder {
    async build(entities, context) {
        const queries = {};

        if (entities.companies.length > 0) {
            const companyNames = entities.companies.map(c => c.text);
            queries.performance = {
                cypher: `
                    MATCH (e:Entity)
                    WHERE e.name IN $companyNames
                    OPTIONAL MATCH (e)-[:INVESTED_IN]->(investment:Entity)
                    RETURN e.name as entityName, 
                           e.totalInvestments as totalInvestments,
                           e.totalInvestmentValue as totalValue,
                           count(investment) as portfolioSize
                    ORDER BY e.totalInvestmentValue DESC
                    LIMIT 20
                `,
                parameters: { companyNames }
            };
        }

        // If people are mentioned, get their performance
        if (entities.people.length > 0) {
            const peopleNames = entities.people.map(p => p.text);
            queries.peoplePerformance = {
                cypher: `
                    MATCH (p:Person)
                    WHERE p.name IN $peopleNames
                    RETURN p.name as personName,
                           p.totalInvestments as investments,
                           p.totalInvestmentValue as totalValue,
                           p.roles as roles
                    ORDER BY p.totalInvestments DESC
                `,
                parameters: { peopleNames }
            };
        }

        return { queries, intent: 'performance_analysis' };
    }
}

class TrendsQueryBuilder {
    async build(entities, context) {
        const queries = {};

        // Sector trends if sectors are mentioned
        if (entities.sectors.length > 0) {
            const sectors = entities.sectors.map(s => s.text);
            queries.sectorTrends = {
                cypher: `
                    MATCH (e:Entity)
                    WHERE any(sector IN $sectors WHERE e.industries CONTAINS sector)
                    RETURN e.industries as industries, 
                           count(e) as entityCount,
                           sum(e.totalInvestmentValue) as totalValue
                    ORDER BY totalValue DESC
                    LIMIT 15
                `,
                parameters: { sectors }
            };
        }

        // Geographic trends if geography mentioned
        if (entities.geographies.length > 0) {
            const regions = entities.geographies.map(g => g.text);
            queries.geographicTrends = {
                cypher: `
                    MATCH (e:Entity)
                    WHERE any(region IN $regions WHERE e.location CONTAINS region OR e.country CONTAINS region)
                    RETURN e.country as country,
                           count(e) as entityCount,
                           sum(e.totalInvestmentValue) as totalValue
                    ORDER BY totalValue DESC
                    LIMIT 10
                `,
                parameters: { regions }
            };
        }

        return { queries, intent: 'trend_analysis' };
    }
}

class ComparisonQueryBuilder {
    async build(entities, context) {
        const queries = {};

        if (entities.companies.length >= 2) {
            const companyNames = entities.companies.map(c => c.text);
            queries.comparison = {
                cypher: `
                    MATCH (e:Entity)
                    WHERE e.name IN $companyNames
                    OPTIONAL MATCH (e)-[:INVESTED_IN]->(portfolio:Entity)
                    RETURN e.name as entityName,
                           e.type as entityType,
                           e.totalInvestments as totalInvestments,
                           e.totalInvestmentValue as totalValue,
                           e.sector as sector,
                           e.country as country,
                           count(portfolio) as portfolioSize
                    ORDER BY e.totalInvestmentValue DESC
                `,
                parameters: { companyNames }
            };
        }

        return { queries, intent: 'entity_comparison' };
    }
}

class DiscoveryQueryBuilder {
    async build(entities, context) {
        const queries = {};

        // Discovery based on sectors
        if (entities.sectors.length > 0) {
            const sectors = entities.sectors.map(s => s.text);
            queries.sectorDiscovery = {
                cypher: `
                    MATCH (e:Entity)
                    WHERE any(sector IN $sectors WHERE e.industries CONTAINS sector)
                    AND e.totalInvestments > 0
                    RETURN e.name as entityName,
                           e.type as entityType,
                           e.totalInvestments as investments,
                           e.industries as industries,
                           e.country as location
                    ORDER BY e.totalInvestments DESC
                    LIMIT 20
                `,
                parameters: { sectors }
            };
        }

        // Discovery based on amounts
        if (entities.amounts.length > 0) {
            const minAmount = this.parseAmount(entities.amounts[0].text);
            queries.amountDiscovery = {
                cypher: `
                    MATCH (e:Entity)
                    WHERE e.totalInvestmentValue >= $minAmount
                    RETURN e.name as entityName,
                           e.type as entityType,
                           e.totalInvestmentValue as totalValue,
                           e.totalInvestments as investments
                    ORDER BY e.totalInvestmentValue DESC
                    LIMIT 15
                `,
                parameters: { minAmount }
            };
        }

        return { queries, intent: 'opportunity_discovery' };
    }

    parseAmount(amountText) {
        const match = amountText.match(/([0-9,]+(?:\.[0-9]+)?)\s*([MBT]?)/i);
        if (!match) return 0;
        
        let value = parseFloat(match[1].replace(/,/g, ''));
        const unit = match[2].toUpperCase();
        
        switch (unit) {
            case 'M': return value * 1000000;
            case 'B': return value * 1000000000;
            case 'T': return value * 1000000000000;
            default: return value;
        }
    }
}

class NetworkQueryBuilder {
    async build(entities, context) {
        const queries = {};

        if (entities.people.length > 0) {
            const peopleNames = entities.people.map(p => p.text);
            queries.networkAnalysis = {
                cypher: `
                    MATCH (p:Person)
                    WHERE p.name IN $peopleNames
                    OPTIONAL MATCH (p)-[r1]-(e:Entity)-[r2]-(otherPerson:Person)
                    WHERE otherPerson <> p
                    RETURN p.name as person,
                           e.name as commonEntity,
                           collect(DISTINCT otherPerson.name) as connections,
                           type(r1) as relationshipType
                    LIMIT 25
                `,
                parameters: { peopleNames }
            };
        }

        return { queries, intent: 'network_analysis' };
    }
}

// Result Processor Classes
class EntityInfoProcessor {
    async process(executionResults, nluOutput) {
        const processed = {
            entities: [],
            relationships: [],
            summary: {},
            insights: []
        };

        if (executionResults.entityInfo && !executionResults.entityInfo.error) {
            for (const record of executionResults.entityInfo.records) {
                if (record.e) {
                    processed.entities.push({
                        name: record.e.name,
                        type: record.e.type,
                        properties: record.e
                    });
                }
                
                if (record.related && record.relationshipType) {
                    processed.relationships.push({
                        from: record.e.name,
                        to: record.related.name,
                        type: record.relationshipType
                    });
                }
            }
        }

        return processed;
    }
}

class RelationshipProcessor {
    async process(executionResults, nluOutput) {
        const processed = {
            connections: [],
            networkInsights: [],
            summary: {}
        };

        if (executionResults.relationships && !executionResults.relationships.error) {
            for (const record of executionResults.relationships.records) {
                if (record.path) {
                    processed.connections.push({
                        pathLength: record.pathLength,
                        entities: record.path // This would need proper path parsing
                    });
                }
            }
        }

        return processed;
    }
}

class PerformanceProcessor {
    async process(executionResults, nluOutput) {
        const processed = {
            performanceMetrics: [],
            rankings: [],
            insights: []
        };

        if (executionResults.performance && !executionResults.performance.error) {
            for (const record of executionResults.performance.records) {
                processed.performanceMetrics.push({
                    entity: record.entityName,
                    totalInvestments: record.totalInvestments,
                    totalValue: record.totalValue,
                    portfolioSize: record.portfolioSize
                });
            }
        }

        return processed;
    }
}

class PortfolioProcessor {
    async process(executionResults, nluOutput) {
        // Implementation for portfolio analysis processing
        return { portfolioAnalysis: executionResults };
    }
}

class TrendsProcessor {
    async process(executionResults, nluOutput) {
        // Implementation for trends processing
        return { trendsAnalysis: executionResults };
    }
}

class ComparisonProcessor {
    async process(executionResults, nluOutput) {
        // Implementation for comparison processing
        return { comparisonAnalysis: executionResults };
    }
}

module.exports = { QueryEngine };
