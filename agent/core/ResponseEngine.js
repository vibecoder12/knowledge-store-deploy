/**
 * Response Generation Engine for Private Markets Intelligence Agent
 * Creates human-friendly, contextual responses from structured query results
 */

class ResponseEngine {
    constructor() {
        this.responseTemplates = new ResponseTemplateManager();
        this.visualizationGenerator = new VisualizationGenerator();
        this.insightGenerator = new InsightGenerator();
    }

    /**
     * Generate comprehensive response from query results
     */
    async generateResponse(queryResults, nluOutput, context = null) {
        try {
            const response = {
                conversationId: context?.conversationId || this.generateConversationId(),
                timestamp: new Date().toISOString(),
                
                // Primary response content
                textualAnswer: await this.generateTextualAnswer(queryResults, nluOutput),
                
                // Supporting data and insights
                structuredData: this.formatStructuredData(queryResults),
                insights: await this.insightGenerator.generateInsights(queryResults, nluOutput),
                visualizations: await this.visualizationGenerator.generateVisualizations(queryResults, nluOutput),
                
                // Interactive elements
                followUpSuggestions: this.generateFollowUpSuggestions(queryResults, nluOutput),
                relatedQuestions: this.generateRelatedQuestions(queryResults, nluOutput),
                
                // Metadata and quality indicators
                confidence: this.calculateResponseConfidence(queryResults, nluOutput),
                sources: this.identifySources(queryResults),
                executionMetadata: queryResults.metadata,
                
                // Conversation management
                contextUpdate: this.generateContextUpdate(queryResults, nluOutput, context)
            };

            return response;

        } catch (error) {
            console.error('Response generation error:', error);
            return this.generateErrorResponse(error, nluOutput);
        }
    }

    async generateTextualAnswer(queryResults, nluOutput) {
        const intentKey = nluOutput.intent.primary;
        const templateManager = this.responseTemplates;

        // Handle errors first
        if (queryResults.error) {
            return templateManager.getErrorTemplate(queryResults.error, nluOutput);
        }

        // Generate intent-specific responses
        switch (intentKey) {
            case 'query.entity.info':
                return this.generateEntityInfoResponse(queryResults, nluOutput);
            
            case 'query.relationship.explore':
                return this.generateRelationshipResponse(queryResults, nluOutput);
            
            case 'query.portfolio.analyze':
                return this.generatePortfolioResponse(queryResults, nluOutput);
            
            case 'analyze.performance':
                return this.generatePerformanceResponse(queryResults, nluOutput);
            
            case 'analyze.market.trends':
                return this.generateTrendsResponse(queryResults, nluOutput);
            
            case 'compare.entities':
                return this.generateComparisonResponse(queryResults, nluOutput);
            
            case 'discover.opportunities':
                return this.generateDiscoveryResponse(queryResults, nluOutput);
            
            case 'explore.networks':
                return this.generateNetworkResponse(queryResults, nluOutput);
            
            default:
                return this.generateGenericResponse(queryResults, nluOutput);
        }
    }

    generateEntityInfoResponse(queryResults, nluOutput) {
        const { processedResults } = queryResults;
        
        if (!processedResults || !processedResults.entities || processedResults.entities.length === 0) {
            const entityNames = nluOutput.entities.companies.map(c => c.text).join(', ');
            return `I couldn't find specific information about ${entityNames} in our database. This might be because the entity name doesn't match exactly, or it might not be in our current dataset.`;
        }

        const entities = processedResults.entities;
        let response = '';

        if (entities.length === 1) {
            const entity = entities[0];
            response += `Here's what I found about **${entity.name}**:\n\n`;
            
            if (entity.properties.type) {
                response += `• **Type**: ${entity.properties.type}\n`;
            }
            
            if (entity.properties.totalInvestments) {
                response += `• **Total Investments**: ${entity.properties.totalInvestments} deals\n`;
            }
            
            if (entity.properties.totalInvestmentValue) {
                const valueMB = Math.round(entity.properties.totalInvestmentValue / 1000000);
                response += `• **Total Investment Value**: $${valueMB}M\n`;
            }
            
            if (entity.properties.sector) {
                response += `• **Sector Focus**: ${entity.properties.sector}\n`;
            }
            
            if (entity.properties.country) {
                response += `• **Location**: ${entity.properties.country}\n`;
            }

            // Add relationship information
            if (processedResults.relationships && processedResults.relationships.length > 0) {
                const relationshipCount = processedResults.relationships.length;
                response += `\n${entity.name} has **${relationshipCount} key relationships** in our database, including investments and partnerships.`;
            }

        } else {
            response += `I found information about **${entities.length} entities** matching your query:\n\n`;
            
            entities.forEach((entity, index) => {
                response += `**${index + 1}. ${entity.name}**\n`;
                response += `   • Type: ${entity.properties.type || 'Unknown'}\n`;
                
                if (entity.properties.totalInvestments) {
                    response += `   • Investments: ${entity.properties.totalInvestments} deals\n`;
                }
                
                response += '\n';
            });
        }

        return response;
    }

    generatePerformanceResponse(queryResults, nluOutput) {
        const { processedResults } = queryResults;
        
        if (!processedResults || !processedResults.performanceMetrics || processedResults.performanceMetrics.length === 0) {
            return "I couldn't find performance data for the entities you mentioned. This might be because they don't have investment activity in our database, or the names don't match exactly.";
        }

        const metrics = processedResults.performanceMetrics;
        let response = '';

        if (metrics.length === 1) {
            const metric = metrics[0];
            response += `Here's the performance data for **${metric.entity}**:\n\n`;
            
            if (metric.totalInvestments) {
                response += `• **Total Investments**: ${metric.totalInvestments} deals\n`;
            }
            
            if (metric.totalValue) {
                const valueMB = Math.round(metric.totalValue / 1000000);
                response += `• **Total Investment Value**: $${valueMB}M\n`;
            }
            
            if (metric.portfolioSize) {
                response += `• **Active Portfolio Size**: ${metric.portfolioSize} companies\n`;
            }

            // Calculate average deal size if possible
            if (metric.totalValue && metric.totalInvestments) {
                const avgDealSize = Math.round((metric.totalValue / metric.totalInvestments) / 1000000);
                response += `• **Average Deal Size**: ~$${avgDealSize}M\n`;
            }

        } else {
            response += `Here's a performance comparison of the entities:\n\n`;
            
            // Sort by total value descending
            const sortedMetrics = metrics.sort((a, b) => (b.totalValue || 0) - (a.totalValue || 0));
            
            sortedMetrics.forEach((metric, index) => {
                const valueMB = metric.totalValue ? Math.round(metric.totalValue / 1000000) : 0;
                response += `**${index + 1}. ${metric.entity}**\n`;
                response += `   • Investment Value: $${valueMB}M across ${metric.totalInvestments || 0} deals\n`;
                response += `   • Portfolio Size: ${metric.portfolioSize || 0} companies\n\n`;
            });
        }

        return response;
    }

    generateComparisonResponse(queryResults, nluOutput) {
        const { processedResults } = queryResults;
        
        if (!processedResults || !processedResults.comparisonAnalysis) {
            return "I couldn't perform the comparison you requested. Please make sure you've specified at least two entities to compare.";
        }

        // This would be implemented based on the specific comparison results structure
        return "Comparison analysis completed. The detailed results are shown in the data section below.";
    }

    generateDiscoveryResponse(queryResults, nluOutput) {
        const { processedResults } = queryResults;
        
        // Handle sector-based discovery
        if (processedResults && processedResults.sectorDiscovery) {
            const entities = processedResults.sectorDiscovery;
            const sectors = nluOutput.entities.sectors.map(s => s.text).join(', ');
            
            let response = `I found **${entities.length} active entities** in the ${sectors} sector(s):\n\n`;
            
            entities.slice(0, 10).forEach((entity, index) => {
                response += `**${index + 1}. ${entity.entityName}**\n`;
                response += `   • Type: ${entity.entityType}\n`;
                response += `   • Investments: ${entity.investments} deals\n`;
                if (entity.location) {
                    response += `   • Location: ${entity.location}\n`;
                }
                response += '\n';
            });

            if (entities.length > 10) {
                response += `... and ${entities.length - 10} more entities in this sector.`;
            }

            return response;
        }

        return "Discovery analysis completed. Here are the opportunities I found based on your criteria.";
    }

    generateGenericResponse(queryResults, nluOutput) {
        const recordCount = queryResults.processedResults ? 
            Object.values(queryResults.processedResults).flat().length : 0;
        
        if (recordCount === 0) {
            return "I searched our database but couldn't find specific results matching your query. This might be because the entities mentioned aren't in our dataset, or the search criteria were too specific.";
        }

        return `I found ${recordCount} relevant data points for your query. The detailed results are shown below, and I've generated some insights that might be helpful.`;
    }

    generateRelationshipResponse(queryResults, nluOutput) {
        return "I've analyzed the relationships between the entities you mentioned. The network connections and paths are visualized below.";
    }

    generatePortfolioResponse(queryResults, nluOutput) {
        return "Here's the portfolio analysis based on your query. I've broken down the investments and relationships for better understanding.";
    }

    generateTrendsResponse(queryResults, nluOutput) {
        return "I've analyzed the market trends based on your criteria. Here are the patterns and insights I discovered.";
    }

    generateNetworkResponse(queryResults, nluOutput) {
        return "Here's the network analysis showing the professional connections and relationships in your query.";
    }

    formatStructuredData(queryResults) {
        if (queryResults.error) {
            return { error: queryResults.error };
        }

        return {
            queryPlan: queryResults.queryPlan,
            executionResults: this.sanitizeExecutionResults(queryResults.executionResults),
            processedResults: queryResults.processedResults,
            recordCounts: this.calculateRecordCounts(queryResults.executionResults)
        };
    }

    sanitizeExecutionResults(executionResults) {
        const sanitized = {};
        
        for (const [queryName, result] of Object.entries(executionResults)) {
            sanitized[queryName] = {
                recordCount: result.recordCount,
                executionTime: result.executionTime,
                hasError: !!result.error,
                sampleRecords: result.records ? result.records.slice(0, 5) : [] // Limit for performance
            };
        }
        
        return sanitized;
    }

    calculateRecordCounts(executionResults) {
        const counts = {};
        let totalRecords = 0;

        for (const [queryName, result] of Object.entries(executionResults)) {
            counts[queryName] = result.recordCount || 0;
            totalRecords += counts[queryName];
        }

        counts.total = totalRecords;
        return counts;
    }

    generateFollowUpSuggestions(queryResults, nluOutput) {
        const suggestions = [];
        const intent = nluOutput.intent.primary;
        const entities = nluOutput.entities;

        // Intent-specific follow-up suggestions
        switch (intent) {
            case 'query.entity.info':
                if (entities.companies.length > 0) {
                    suggestions.push(`Analyze the performance of ${entities.companies[0].text}`);
                    suggestions.push(`Show me the portfolio of ${entities.companies[0].text}`);
                    suggestions.push(`Find competitors of ${entities.companies[0].text}`);
                }
                break;

            case 'analyze.performance':
                suggestions.push('Compare this performance to industry benchmarks');
                suggestions.push('Show me the investment timeline');
                suggestions.push('Analyze the risk factors');
                break;

            case 'compare.entities':
                suggestions.push('Show me more detailed metrics for the comparison');
                suggestions.push('Find similar entities for broader comparison');
                suggestions.push('Analyze the market trends affecting these entities');
                break;

            case 'discover.opportunities':
                suggestions.push('Narrow down the search with specific criteria');
                suggestions.push('Analyze the performance of these opportunities');
                suggestions.push('Find the key people involved in these opportunities');
                break;
        }

        // Add generic suggestions if no specific ones
        if (suggestions.length === 0) {
            suggestions.push('Ask me about a specific company or fund');
            suggestions.push('Compare different investment strategies');
            suggestions.push('Explore market trends in a sector');
        }

        return suggestions.slice(0, 4); // Limit to 4 suggestions
    }

    generateRelatedQuestions(queryResults, nluOutput) {
        const questions = [];
        const entities = nluOutput.entities;

        // Generate questions based on entities found
        if (entities.companies.length > 0) {
            const companyName = entities.companies[0].text;
            questions.push(`What is the investment strategy of ${companyName}?`);
            questions.push(`Who are the key partners at ${companyName}?`);
            questions.push(`What sectors does ${companyName} focus on?`);
        }

        if (entities.people.length > 0) {
            const personName = entities.people[0].text;
            questions.push(`What is the track record of ${personName}?`);
            questions.push(`Which companies has ${personName} invested in?`);
            questions.push(`Who does ${personName} frequently co-invest with?`);
        }

        if (entities.sectors.length > 0) {
            const sector = entities.sectors[0].text;
            questions.push(`Which are the most active funds in ${sector}?`);
            questions.push(`What are the latest trends in ${sector}?`);
            questions.push(`Who are the top performers in ${sector}?`);
        }

        return questions.slice(0, 3);
    }

    calculateResponseConfidence(queryResults, nluOutput) {
        let confidence = nluOutput.confidence || 0.5;

        // Boost confidence if we found relevant results
        if (queryResults.processedResults && !queryResults.error) {
            const hasResults = Object.values(queryResults.processedResults).some(result => 
                Array.isArray(result) ? result.length > 0 : result
            );
            
            if (hasResults) {
                confidence = Math.min(confidence + 0.2, 1.0);
            }
        }

        // Reduce confidence for errors
        if (queryResults.error) {
            confidence = Math.max(confidence - 0.3, 0.1);
        }

        return Math.round(confidence * 100) / 100; // Round to 2 decimal places
    }

    identifySources(queryResults) {
        const sources = ['Private Markets Knowledge Store'];

        // Add specific data sources based on query results
        if (queryResults.processedResults) {
            if (queryResults.processedResults.entities) {
                sources.push('Entity Database');
            }
            if (queryResults.processedResults.performanceMetrics) {
                sources.push('Investment Performance Data');
            }
            if (queryResults.processedResults.relationships) {
                sources.push('Relationship Network Data');
            }
        }

        return [...new Set(sources)]; // Remove duplicates
    }

    generateContextUpdate(queryResults, nluOutput, previousContext) {
        const contextUpdate = {
            lastQuery: nluOutput.originalMessage,
            lastIntent: nluOutput.intent.primary,
            entitiesDiscussed: [
                ...(nluOutput.entities.companies || []).map(c => c.text),
                ...(nluOutput.entities.people || []).map(p => p.text)
            ],
            topicsExplored: [nluOutput.intent.primary],
            analysisScope: {
                sectors: nluOutput.entities.sectors.map(s => s.text),
                timeframes: nluOutput.entities.timeframes.map(t => t.text),
                geographies: nluOutput.entities.geographies.map(g => g.text)
            },
            resultQuality: {
                recordsFound: queryResults.processedResults ? 
                    Object.values(queryResults.processedResults).flat().length : 0,
                hasErrors: !!queryResults.error,
                confidence: this.calculateResponseConfidence(queryResults, nluOutput)
            }
        };

        return contextUpdate;
    }

    generateErrorResponse(error, nluOutput) {
        return {
            conversationId: this.generateConversationId(),
            timestamp: new Date().toISOString(),
            textualAnswer: "I apologize, but I encountered an error while processing your request. Please try rephrasing your question or contact support if the issue persists.",
            error: {
                message: error.message,
                type: 'processing_error'
            },
            followUpSuggestions: [
                "Try asking about a specific company or fund",
                "Rephrase your question with more specific terms",
                "Ask for help with query examples"
            ],
            confidence: 0.1
        };
    }

    generateConversationId() {
        return 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
}

class ResponseTemplateManager {
    getErrorTemplate(error, nluOutput) {
        if (error.includes('No query builder found')) {
            return "I understand what you're asking, but I'm not sure how to handle that type of query yet. Could you try rephrasing your question in a different way?";
        }

        if (error.includes('timeout') || error.includes('connection')) {
            return "I'm having trouble accessing the database right now. Please try again in a moment.";
        }

        return "I encountered an issue while searching for that information. Please try rephrasing your question or being more specific.";
    }
}

class VisualizationGenerator {
    async generateVisualizations(queryResults, nluOutput) {
        const visualizations = [];
        const intent = nluOutput.intent.primary;

        // Generate intent-specific visualizations
        switch (intent) {
            case 'compare.entities':
                visualizations.push(this.generateComparisonChart(queryResults));
                break;

            case 'analyze.performance':
                visualizations.push(this.generatePerformanceChart(queryResults));
                break;

            case 'query.relationship.explore':
                visualizations.push(this.generateNetworkGraph(queryResults));
                break;

            case 'analyze.market.trends':
                visualizations.push(this.generateTrendChart(queryResults));
                break;

            case 'query.portfolio.analyze':
                visualizations.push(this.generatePortfolioBreakdown(queryResults));
                break;
        }

        return visualizations.filter(viz => viz !== null);
    }

    generateComparisonChart(queryResults) {
        return {
            type: 'comparison_bar_chart',
            title: 'Entity Comparison',
            description: 'Comparative analysis of the entities',
            data: queryResults.processedResults?.comparisonAnalysis || null
        };
    }

    generatePerformanceChart(queryResults) {
        return {
            type: 'performance_chart',
            title: 'Investment Performance',
            description: 'Performance metrics visualization',
            data: queryResults.processedResults?.performanceMetrics || null
        };
    }

    generateNetworkGraph(queryResults) {
        return {
            type: 'network_graph',
            title: 'Relationship Network',
            description: 'Network visualization of entity relationships',
            data: queryResults.processedResults?.connections || null
        };
    }

    generateTrendChart(queryResults) {
        return {
            type: 'trend_chart',
            title: 'Market Trends',
            description: 'Trend analysis visualization',
            data: queryResults.processedResults?.trendsAnalysis || null
        };
    }

    generatePortfolioBreakdown(queryResults) {
        return {
            type: 'portfolio_pie_chart',
            title: 'Portfolio Breakdown',
            description: 'Portfolio composition analysis',
            data: queryResults.processedResults?.portfolioAnalysis || null
        };
    }
}

class InsightGenerator {
    async generateInsights(queryResults, nluOutput) {
        const insights = [];

        // Generate insights based on results
        if (queryResults.processedResults) {
            const performanceInsights = this.generatePerformanceInsights(queryResults.processedResults);
            const relationshipInsights = this.generateRelationshipInsights(queryResults.processedResults);
            const trendInsights = this.generateTrendInsights(queryResults.processedResults);

            insights.push(...performanceInsights, ...relationshipInsights, ...trendInsights);
        }

        return insights.slice(0, 5); // Limit to 5 insights
    }

    generatePerformanceInsights(processedResults) {
        const insights = [];

        if (processedResults.performanceMetrics) {
            const metrics = processedResults.performanceMetrics;
            
            if (metrics.length > 1) {
                const topPerformer = metrics.reduce((prev, curr) => 
                    (prev.totalValue || 0) > (curr.totalValue || 0) ? prev : curr
                );
                
                insights.push({
                    type: 'performance_leader',
                    message: `${topPerformer.entity} shows the highest total investment value in this comparison.`,
                    confidence: 0.8
                });
            }
        }

        return insights;
    }

    generateRelationshipInsights(processedResults) {
        const insights = [];

        if (processedResults.relationships && processedResults.relationships.length > 0) {
            insights.push({
                type: 'relationship_density',
                message: `Found ${processedResults.relationships.length} key relationships between the entities.`,
                confidence: 0.7
            });
        }

        return insights;
    }

    generateTrendInsights(processedResults) {
        const insights = [];

        // Add trend-based insights when trend data is available
        if (processedResults.trendsAnalysis) {
            insights.push({
                type: 'trend_observation',
                message: 'Market trend patterns identified in the data.',
                confidence: 0.6
            });
        }

        return insights;
    }
}

module.exports = { ResponseEngine };
