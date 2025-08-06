/**
 * Natural Language Understanding Engine for Private Markets Intelligence Agent
 * Handles intent classification, entity extraction, and query understanding
 */

class NLUEngine {
    constructor() {
        this.intentClassifier = new IntentClassifier();
        this.entityExtractor = new EntityExtractor();
        this.contextManager = new ContextManager();
    }

    /**
     * Process natural language input and extract structured information
     */
    async processMessage(message, context = null) {
        return await this.processInput(message, context);
    }

    /**
     * Process natural language input and extract structured information
     */
    async processInput(message, context = null) {
        const processed = {
            originalMessage: message,
            timestamp: new Date().toISOString(),
            
            // Core NLU components
            intent: await this.intentClassifier.classify(message, context),
            entities: await this.entityExtractor.extract(message),
            
            // Context management
            context: this.contextManager.updateContext(message, context),
            
            // Query analysis
            complexity: this.analyzeComplexity(message),
            confidence: 0.0 // Will be calculated
        };

        // Calculate overall confidence
        processed.confidence = this.calculateConfidence(processed);

        return processed;
    }

    analyzeComplexity(message) {
        const indicators = {
            entityCount: (message.match(/\b[A-Z][a-z]+ Capital\b/g) || []).length,
            timeReferences: (message.match(/\b(last|past|since|during|between|from|to)\b/gi) || []).length,
            numberReferences: (message.match(/\$[0-9,]+[MBT]?|\b[0-9,]+%|\b[0-9,]+ years?\b/g) || []).length,
            analyticalTerms: (message.match(/\b(analyze|compare|performance|trends|correlation|impact)\b/gi) || []).length,
            conditionals: (message.match(/\b(if|when|where|that|which|who)\b/gi) || []).length
        };

        const complexityScore = (
            indicators.entityCount * 2 +
            indicators.timeReferences * 1.5 +
            indicators.numberReferences * 1.2 +
            indicators.analyticalTerms * 2.5 +
            indicators.conditionals * 1.8
        );

        if (complexityScore < 5) return 'simple';
        if (complexityScore < 12) return 'moderate';
        if (complexityScore < 20) return 'complex';
        return 'very_complex';
    }

    calculateConfidence(processed) {
        const intentConfidence = processed.intent.confidence || 0.5;
        const entityConfidence = processed.entities.confidence || 0.5;
        const contextRelevance = processed.context.relevanceScore || 0.5;

        return (intentConfidence * 0.4 + entityConfidence * 0.3 + contextRelevance * 0.3);
    }
}

class IntentClassifier {
    constructor() {
        this.intentPatterns = {
            // Information Retrieval
            'query.entity.info': {
                patterns: [
                    /tell me about|information about|what is|who is|describe/i,
                    /details on|background on|overview of/i
                ],
                keywords: ['about', 'information', 'details', 'what', 'who', 'describe', 'overview']
            },
            
            'query.relationship.explore': {
                patterns: [
                    /relationship|connected to|links between|network|associations/i,
                    /works with|partners with|invested in|board|syndicate/i
                ],
                keywords: ['relationship', 'connected', 'network', 'partners', 'syndicate', 'board']
            },

            'query.portfolio.analyze': {
                patterns: [
                    /portfolio|investments of|holdings|positions/i,
                    /what has.*invested|companies backed by/i
                ],
                keywords: ['portfolio', 'investments', 'holdings', 'backed', 'positions']
            },

            // Analysis & Insights
            'analyze.performance': {
                patterns: [
                    /performance|returns|IRR|multiple|track record/i,
                    /how well|success rate|performance metrics/i
                ],
                keywords: ['performance', 'returns', 'IRR', 'multiple', 'success', 'metrics']
            },

            'analyze.market.trends': {
                patterns: [
                    /trends|trending|growth|decline|market/i,
                    /what's happening|emerging|rising|falling/i
                ],
                keywords: ['trends', 'trending', 'growth', 'market', 'emerging', 'rising']
            },

            'analyze.risk.assessment': {
                patterns: [
                    /risk|risky|safe|volatile|stability/i,
                    /concerns|red flags|warning signs/i
                ],
                keywords: ['risk', 'risky', 'volatile', 'concerns', 'warnings', 'stability']
            },

            // Comparison & Benchmarking
            'compare.entities': {
                patterns: [
                    /compare|versus|vs|difference between|how does.*compare/i,
                    /better than|worse than|similar to/i
                ],
                keywords: ['compare', 'versus', 'vs', 'difference', 'better', 'worse', 'similar']
            },

            'benchmark.performance': {
                patterns: [
                    /benchmark|against peers|industry average|market performance/i,
                    /how does.*rank|percentile|quartile/i
                ],
                keywords: ['benchmark', 'peers', 'average', 'rank', 'percentile', 'quartile']
            },

            // Prediction & Recommendations
            'predict.outcomes': {
                patterns: [
                    /predict|forecast|future|outlook|projections/i,
                    /what will happen|expected to|likely to/i
                ],
                keywords: ['predict', 'forecast', 'future', 'outlook', 'expected', 'likely']
            },

            'recommend.investments': {
                patterns: [
                    /recommend|suggest|should I invest|good investment/i,
                    /opportunities|potential|candidates/i
                ],
                keywords: ['recommend', 'suggest', 'opportunities', 'potential', 'candidates']
            },

            // Discovery & Exploration
            'discover.opportunities': {
                patterns: [
                    /find|discover|identify|search for|look for/i,
                    /opportunities|deals|investments|companies/i
                ],
                keywords: ['find', 'discover', 'identify', 'search', 'opportunities', 'deals']
            },

            'explore.networks': {
                patterns: [
                    /network|connections|who knows|alumni|colleagues/i,
                    /worked together|co-invested|syndicate members/i
                ],
                keywords: ['network', 'connections', 'alumni', 'colleagues', 'co-invested']
            }
        };
    }

    async classify(message, context = null) {
        const scores = {};
        const normalizedMessage = message.toLowerCase();

        // Score each intent
        for (const [intentName, intentData] of Object.entries(this.intentPatterns)) {
            let score = 0;
            
            // Pattern matching
            for (const pattern of intentData.patterns) {
                if (pattern.test(message)) {
                    score += 3;
                }
            }

            // Keyword matching
            for (const keyword of intentData.keywords) {
                if (normalizedMessage.includes(keyword)) {
                    score += 1;
                }
            }

            // Context boost
            if (context && context.recentIntents) {
                if (context.recentIntents.includes(intentName)) {
                    score += 1; // Boost for conversation continuity
                }
            }

            if (score > 0) {
                scores[intentName] = score;
            }
        }

        // Find best match
        const sortedIntents = Object.entries(scores)
            .sort(([,a], [,b]) => b - a)
            .map(([intent, score]) => ({
                intent,
                confidence: Math.min(score / 10, 1.0) // Normalize to 0-1
            }));

        const primaryIntent = sortedIntents[0] || { 
            intent: 'query.general', 
            confidence: 0.3 
        };

        return {
            primary: primaryIntent.intent,
            confidence: primaryIntent.confidence,
            alternatives: sortedIntents.slice(1, 3),
            allScores: scores
        };
    }
}

class EntityExtractor {
    constructor() {
        this.entityPatterns = {
            // Financial entities
            companies: {
                patterns: [
                    // Standard company patterns with suffixes
                    /\b([A-Z][a-zA-Z0-9]*(?:\s+[A-Z][a-zA-Z0-9]*)*)\s+(?:Capital|Ventures|Partners|Fund|Management|Investments?|Group|Holdings?|Corp\.?|Inc\.?|LLC)\b/g,
                    /\b([A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*)*),?\s+(?:a|an|the)?\s*(?:venture capital|private equity|investment|fund)/gi,
                    // Well-known private equity/investment firms (single words)
                    /\b(Blackstone|KKR|Apollo|Carlyle|Bain|TPG|Warburg|Kohlberg|Kravis|Roberts|Sequoia|Andreessen|Horowitz)\b/gi,
                    // Multi-word well-known firms
                    /\b(Blackstone Group|Apollo Global|Carlyle Group|Bain Capital|TPG Capital|Warburg Pincus|Silver Lake|Vista Equity|General Atlantic|Advent International)\b/gi
                ],
                type: 'company'
            },

            people: {
                patterns: [
                    /\b([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b(?=\s+(?:partner|managing|founder|CEO|CTO|VP|director))/gi,
                    /(?:partner|managing|founder|CEO|CTO|VP|director)\s+([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi
                ],
                type: 'person'
            },

            amounts: {
                patterns: [
                    /\$([0-9,]+(?:\.[0-9]+)?)\s*([MBT]?)/gi,
                    /([0-9,]+(?:\.[0-9]+)?)\s*(million|billion|trillion)/gi
                ],
                type: 'amount'
            },

            timeframes: {
                patterns: [
                    /(?:last|past|since|during|in|from)\s+([0-9]+)\s+(years?|months?|quarters?)/gi,
                    /(20[0-9]{2})(?:\s*[-–]\s*(20[0-9]{2}))?/g,
                    /\b(Q[1-4]\s+20[0-9]{2})\b/gi
                ],
                type: 'timeframe'
            },

            sectors: {
                patterns: [
                    /\b(technology|enterprise software|fintech|biotech|healthcare|real estate|infrastructure|energy|consumer|SaaS|artificial intelligence|machine learning|blockchain|cryptocurrency|tech)\b/gi
                ],
                type: 'sector'
            },

            geographies: {
                patterns: [
                    /\b(Silicon Valley|San Francisco|New York|Boston|London|Europe|Asia|China|India|US|USA|United States)\b/gi
                ],
                type: 'geography'
            },

            metrics: {
                patterns: [
                    /\b(IRR|multiple|TVPI|DPI|RVPI|PME|success rate|hit rate)\b/gi,
                    /([0-9]+(?:\.[0-9]+)?x)\s*(?:multiple|return)/gi,
                    /([0-9]+(?:\.[0-9]+)?)%\s*(?:IRR|return)/gi
                ],
                type: 'metric'
            }
        };
    }

    async extract(message) {
        const entities = {
            companies: [],
            people: [],
            amounts: [],
            timeframes: [],
            sectors: [],
            geographies: [],
            metrics: [],
            confidence: 0.0
        };

        let totalMatches = 0;
        let totalPatterns = 0;

        // Extract entities by category
        for (const [category, categoryData] of Object.entries(this.entityPatterns)) {
            for (const pattern of categoryData.patterns) {
                totalPatterns++;
                const matches = [...message.matchAll(pattern)];
                
                if (matches.length > 0) {
                    totalMatches++;
                    for (const match of matches) {
                        // Get the captured group or the full match, clean up whitespace
                        const entityText = (match[1] || match[0]).trim();
                        
                        if (entityText && !entities[category].some(e => e.text === entityText)) {
                            entities[category].push({
                                text: entityText,
                                type: categoryData.type,
                                position: match.index,
                                confidence: 0.8 // Base confidence
                            });
                        }
                    }
                }
            }
        }

        // Calculate overall confidence
        entities.confidence = totalPatterns > 0 ? totalMatches / totalPatterns : 0.0;

        return entities;
    }
}

class ContextManager {
    constructor() {
        this.maxHistorySize = 10;
    }

    updateContext(message, previousContext = null) {
        const context = {
            currentMessage: message,
            timestamp: new Date().toISOString(),
            messageHistory: [],
            entityStack: [],
            topicFlow: [],
            analysisScope: {},
            recentIntents: [],
            conversationState: 'active',
            relevanceScore: 0.5
        };

        if (previousContext && previousContext.messageHistory) {
            // Inherit from previous context
            context.messageHistory = [
                ...previousContext.messageHistory.slice(-this.maxHistorySize + 1),
                { message, timestamp: context.timestamp }
            ];
            
            context.entityStack = previousContext.entityStack ? [...previousContext.entityStack] : [];
            context.topicFlow = previousContext.topicFlow ? [...previousContext.topicFlow] : [];
            context.analysisScope = previousContext.analysisScope ? { ...previousContext.analysisScope } : {};
            context.recentIntents = previousContext.recentIntents ? [...previousContext.recentIntents.slice(-5)] : [];

            // Calculate relevance to previous conversation
            context.relevanceScore = this.calculateRelevance(message, previousContext);
        } else {
            context.messageHistory = [{ message, timestamp: context.timestamp }];
        }

        return context;
    }

    calculateRelevance(message, previousContext) {
        if (!previousContext || !previousContext.entityStack || !previousContext.entityStack.length) {
            return 0.3; // Low relevance for new conversations
        }

        let relevanceScore = 0;
        const messageLower = message.toLowerCase();

        // Check for entity continuity
        for (const entity of previousContext.entityStack.slice(-3)) {
            if (messageLower.includes(entity.toLowerCase())) {
                relevanceScore += 0.3;
            }
        }

        // Check for topic continuity  
        if (previousContext.topicFlow && previousContext.topicFlow.length > 0) {
            for (const topic of previousContext.topicFlow.slice(-2)) {
                if (messageLower.includes(topic.toLowerCase())) {
                    relevanceScore += 0.2;
                }
            }
        }

        return Math.min(relevanceScore, 1.0);
    }
}

module.exports = { NLUEngine };
