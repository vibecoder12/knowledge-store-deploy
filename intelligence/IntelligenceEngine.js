/**
 * Intelligence Engine
 * AI-powered analysis and insights for the Private Markets Knowledge Store
 */

const OpenAI = require('openai');
const natural = require('natural');
const compromise = require('compromise');
const winston = require('winston');

class IntelligenceEngine {
    constructor(config) {
        this.config = config;
        this.ready = false;
        
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.simple(),
            defaultMeta: { service: 'intelligence-engine' },
            transports: [new winston.transports.Console()]
        });

        // Initialize NLP tools
        this.tokenizer = new natural.WordTokenizer();
        this.stemmer = natural.PorterStemmer;
        try {
            this.sentiment = new natural.SentimentAnalyzer('English', 
                natural.PorterStemmer, ['negation']);
        } catch (error) {
            // Fallback for sentiment analysis
            this.sentiment = null;
        }

        // Initialize OpenAI if API key is available
        if (config.ai?.openai?.apiKey) {
            this.openai = new OpenAI({
                apiKey: config.ai.openai.apiKey
            });
        }

        // Entity patterns for NER
        this.entityPatterns = {
            COMPANY: /\b([A-Z][a-zA-Z\s&-]+(?:Inc|LLC|Corp|Ltd|LP|LLP|Partners|Group|Capital|Management|Investments?|Fund|Asset|Global|International|Holdings?))\b/g,
            FUND: /\b([A-Z][a-zA-Z\s&-]*(?:Fund|Capital|Ventures?|Partners|Investment|Asset\s+Management|Private\s+Equity))\b/g,
            PERSON: /\b([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b(?=\s+(?:CEO|CTO|CFO|Partner|Managing|Director|Founder))/g,
            LOCATION: /\b([A-Z][a-zA-Z\s]+(?:,\s*[A-Z]{2}|,\s*[A-Z][a-zA-Z\s]+))\b/g,
            MONEY: /\$\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(million|billion|M|B)?\b/gi,
            SECTOR: /\b(?:infrastructure|real\s+estate|private\s+equity|hedge\s+fund|venture\s+capital|fintech|healthcare|energy|technology|telecommunications|transportation|utilities|renewable|digital|cyber|logistics|industrial|consumer|financial\s+services)\b/gi
        };

        // Investment themes and concepts
        this.investmentThemes = [
            'ESG', 'sustainability', 'climate change', 'carbon neutral', 'renewable energy',
            'digital transformation', 'fintech', 'artificial intelligence', 'machine learning',
            'supply chain', 'logistics', 'infrastructure', 'transportation', 'utilities',
            'healthcare', 'biotechnology', 'pharmaceutical', 'medical devices',
            'real estate', 'commercial property', 'residential', 'industrial',
            'energy transition', 'clean energy', 'solar', 'wind', 'hydro',
            'data centers', 'cloud computing', 'cybersecurity', 'telecommunications'
        ];
    }

    async initialize() {
        try {
            this.logger.info('🔄 Initializing Intelligence Engine...');

            // Test OpenAI connection if available
            if (this.openai) {
                try {
                    await this.openai.models.list();
                    this.logger.info('✅ OpenAI connection verified');
                } catch (error) {
                    this.logger.warn('⚠️  OpenAI connection failed:', error.message);
                    this.openai = null;
                }
            }

            this.ready = true;
            this.logger.info('✅ Intelligence Engine initialized');

        } catch (error) {
            this.logger.error('❌ Failed to initialize Intelligence Engine:', error);
            throw error;
        }
    }

    isReady() {
        return this.ready;
    }

    /**
     * Parse natural language query to understand intent
     */
    async parseQuery(queryText) {
        try {
            this.logger.debug(`🔍 Parsing query: "${queryText}"`);

            // Basic NLP analysis
            const doc = compromise(queryText);
            const tokens = this.tokenizer.tokenize(queryText.toLowerCase());
            const stems = tokens.map(token => this.stemmer.stem(token));

            // Extract entities from query
            const entities = this.extractEntitiesFromText(queryText);

            // Identify query intent
            const intent = this.identifyQueryIntent(queryText, tokens);

            // Extract entity types mentioned
            const entityTypes = this.extractEntityTypes(queryText);

            // Extract relationship types
            const relationships = this.extractRelationshipTypes(queryText);

            // Extract keywords
            const keywords = this.extractKeywords(tokens, stems);

            // Determine query complexity
            const complexity = this.assessQueryComplexity(queryText, entities, relationships);

            const queryIntent = {
                text: queryText,
                intent: intent,
                entityTypes: entityTypes,
                relationships: relationships,
                keywords: keywords,
                entities: entities,
                complexity: complexity,
                themes: this.identifyInvestmentThemes(queryText),
                sentiment: this.analyzeSentiment(tokens)
            };

            this.logger.debug('Query intent:', queryIntent);
            return queryIntent;

        } catch (error) {
            this.logger.error('❌ Failed to parse query:', error);
            throw error;
        }
    }

    /**
     * Enhance entity data with AI insights
     */
    async enhanceEntity(entityData) {
        try {
            const enhanced = { ...entityData };

            // Extract additional entities from description
            if (entityData.description) {
                enhanced.extractedEntities = this.extractEntitiesFromText(entityData.description);
            }

            // Identify investment themes
            const textContent = [entityData.name, entityData.description, entityData.primaryServices].join(' ');
            enhanced.themes = this.identifyInvestmentThemes(textContent);

            // Normalize sector classification
            enhanced.normalizedSector = this.normalizeSector(entityData.sector || entityData.type);

            // Extract and parse financial data
            if (entityData.aum) {
                enhanced.aumNumeric = this.parseFinancialAmount(entityData.aum);
            }

            // Generate AI-powered insights if OpenAI is available
            if (this.openai && entityData.description) {
                enhanced.aiInsights = await this.generateAIInsights(entityData);
            }

            return enhanced;

        } catch (error) {
            this.logger.error('❌ Failed to enhance entity:', error);
            return entityData;
        }
    }

    /**
     * Extract entities from text using NLP
     */
    extractEntitiesFromText(text) {
        const entities = {};

        // Extract using patterns
        for (const [entityType, pattern] of Object.entries(this.entityPatterns)) {
            const matches = [...text.matchAll(pattern)];
            if (matches.length > 0) {
                entities[entityType] = matches.map(match => ({
                    text: match[1] || match[0],
                    position: match.index,
                    confidence: 0.8
                }));
            }
        }

        return entities;
    }

    /**
     * Identify query intent
     */
    identifyQueryIntent(queryText, tokens) {
        const queryLower = queryText.toLowerCase();

        // Search patterns
        if (tokens.some(t => ['find', 'search', 'show', 'list', 'get'].includes(t))) {
            if (tokens.some(t => ['similar', 'like', 'comparable'].includes(t))) {
                return 'similarity_search';
            }
            if (tokens.some(t => ['relationship', 'connection', 'related', 'connected'].includes(t))) {
                return 'relationship_search';
            }
            return 'entity_search';
        }

        // Analysis patterns
        if (tokens.some(t => ['analyze', 'analysis', 'insight', 'trend', 'pattern'].includes(t))) {
            return 'analysis';
        }

        // Comparison patterns  
        if (tokens.some(t => ['compare', 'versus', 'vs', 'difference'].includes(t))) {
            return 'comparison';
        }

        // Path finding patterns
        if (tokens.some(t => ['path', 'route', 'connection', 'how'].includes(t)) && 
            tokens.some(t => ['connect', 'related', 'linked'].includes(t))) {
            return 'path_finding';
        }

        // Market intelligence patterns
        if (tokens.some(t => ['market', 'industry', 'sector', 'trend', 'opportunity'].includes(t))) {
            return 'market_intelligence';
        }

        return 'general_search';
    }

    /**
     * Extract entity types from query
     */
    extractEntityTypes(queryText) {
        const entityTypes = [];
        const queryLower = queryText.toLowerCase();

        const typeMapping = {
            'company': ['COMPANY'],
            'companies': ['COMPANY'],
            'fund': ['FUND'],
            'funds': ['FUND'],
            'investor': ['COMPANY', 'FUND'],
            'investors': ['COMPANY', 'FUND'],
            'person': ['PERSON'],
            'people': ['PERSON'],
            'individual': ['PERSON'],
            'firm': ['COMPANY', 'FUND'],
            'firms': ['COMPANY', 'FUND'],
            'manager': ['COMPANY', 'FUND'],
            'management': ['COMPANY', 'FUND']
        };

        for (const [keyword, types] of Object.entries(typeMapping)) {
            if (queryLower.includes(keyword)) {
                entityTypes.push(...types);
            }
        }

        return [...new Set(entityTypes)];
    }

    /**
     * Extract relationship types from query
     */
    extractRelationshipTypes(queryText) {
        const relationships = [];
        const queryLower = queryText.toLowerCase();

        const relationshipMapping = {
            'invest': ['INVESTS_IN'],
            'partner': ['PARTNERS_WITH'],
            'acquire': ['ACQUIRED_BY'],
            'manage': ['MANAGES'],
            'own': ['OWNS'],
            'compete': ['COMPETES_WITH'],
            'collaborate': ['PARTNERS_WITH'],
            'work with': ['PARTNERS_WITH'],
            'co-invest': ['CO_INVESTED'],
            'follow': ['FOLLOWS_STRATEGY']
        };

        for (const [keyword, types] of Object.entries(relationshipMapping)) {
            if (queryLower.includes(keyword)) {
                relationships.push(...types);
            }
        }

        return [...new Set(relationships)];
    }

    /**
     * Extract relevant keywords
     */
    extractKeywords(tokens, stems) {
        // Remove stop words
        const stopWords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 
            'of', 'with', 'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be', 
            'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 
            'would', 'could', 'should', 'may', 'might', 'must', 'can'
        ]);

        const keywords = tokens
            .filter(token => token.length > 2)
            .filter(token => !stopWords.has(token))
            .filter(token => !/^\d+$/.test(token)); // Remove pure numbers

        // Add investment themes if found
        const themes = this.investmentThemes.filter(theme => 
            tokens.some(token => token.includes(theme.toLowerCase().split(' ')[0]))
        );

        return [...new Set([...keywords, ...themes])];
    }

    /**
     * Assess query complexity
     */
    assessQueryComplexity(queryText, entities, relationships) {
        let complexity = 'simple';
        let score = 0;

        // Length factor
        if (queryText.length > 100) score += 1;
        if (queryText.length > 200) score += 1;

        // Entity factor
        const totalEntities = Object.values(entities).flat().length;
        if (totalEntities > 3) score += 1;
        if (totalEntities > 6) score += 1;

        // Relationship factor
        if (relationships.length > 1) score += 1;
        if (relationships.length > 3) score += 1;

        // Logical operators
        if (/\b(and|or|not)\b/i.test(queryText)) score += 1;

        // Comparative language
        if (/\b(compare|versus|vs|better|worse|similar|different)\b/i.test(queryText)) score += 1;

        // Temporal language
        if (/\b(since|before|after|during|recent|trend|historical)\b/i.test(queryText)) score += 1;

        if (score >= 4) complexity = 'complex';
        else if (score >= 2) complexity = 'medium';

        return complexity;
    }

    /**
     * Identify investment themes in text
     */
    identifyInvestmentThemes(text) {
        const textLower = text.toLowerCase();
        const foundThemes = [];

        for (const theme of this.investmentThemes) {
            if (textLower.includes(theme.toLowerCase())) {
                foundThemes.push({
                    theme: theme,
                    confidence: 0.8,
                    context: this.extractThemeContext(text, theme)
                });
            }
        }

        return foundThemes;
    }

    /**
     * Extract context around investment themes
     */
    extractThemeContext(text, theme) {
        const words = text.split(/\s+/);
        const themeWords = theme.toLowerCase().split(/\s+/);
        
        for (let i = 0; i < words.length; i++) {
            if (words[i].toLowerCase().includes(themeWords[0])) {
                const start = Math.max(0, i - 5);
                const end = Math.min(words.length, i + 10);
                return words.slice(start, end).join(' ');
            }
        }
        
        return '';
    }

    /**
     * Analyze sentiment of query
     */
    analyzeSentiment(tokens) {
        try {
            if (!this.sentiment) {
                return { score: 0, sentiment: 'neutral' };
            }
            
            const stemmedTokens = tokens.map(token => this.stemmer.stem(token));
            const score = this.sentiment.getSentiment(stemmedTokens);
            
            let sentiment = 'neutral';
            if (score > 0.1) sentiment = 'positive';
            else if (score < -0.1) sentiment = 'negative';
            
            return { score, sentiment };
        } catch (error) {
            return { score: 0, sentiment: 'neutral' };
        }
    }

    /**
     * Normalize sector classification
     */
    normalizeSector(sector) {
        if (!sector) return 'Unknown';
        
        const sectorLower = sector.toLowerCase();
        
        const sectorMap = {
            'infrastructure': 'Infrastructure',
            'infra': 'Infrastructure',
            'private equity': 'Private Equity',
            'pe': 'Private Equity',
            'hedge fund': 'Hedge Funds',
            'hedge': 'Hedge Funds',
            'real estate': 'Real Estate',
            'property': 'Real Estate',
            'venture capital': 'Venture Capital',
            'vc': 'Venture Capital',
            'credit': 'Private Credit',
            'debt': 'Private Credit'
        };

        for (const [key, value] of Object.entries(sectorMap)) {
            if (sectorLower.includes(key)) {
                return value;
            }
        }

        return sector;
    }

    /**
     * Parse financial amounts
     */
    parseFinancialAmount(amountStr) {
        if (!amountStr || typeof amountStr !== 'string') return 0;
        
        // Remove currency symbols and clean up
        const cleaned = amountStr.replace(/[\$,€£¥]/g, '').trim();
        
        // Handle multipliers
        const multipliers = {
            'trillion': 1e12,
            't': 1e12,
            'billion': 1e9,
            'b': 1e9,
            'million': 1e6,
            'm': 1e6,
            'thousand': 1e3,
            'k': 1e3
        };

        for (const [suffix, multiplier] of Object.entries(multipliers)) {
            const regex = new RegExp(`\\b${suffix}\\b`, 'i');
            if (regex.test(cleaned)) {
                const number = parseFloat(cleaned.replace(regex, ''));
                return isNaN(number) ? 0 : number * multiplier;
            }
        }

        const number = parseFloat(cleaned);
        return isNaN(number) ? 0 : number;
    }

    /**
     * Generate AI-powered insights using OpenAI
     */
    async generateAIInsights(entityData) {
        if (!this.openai) return null;

        try {
            const prompt = `Analyze this private markets entity and provide key insights:

Name: ${entityData.name}
Type: ${entityData.type}
Sector: ${entityData.sector || 'Unknown'}
AUM: ${entityData.aum || 'Unknown'}
Location: ${entityData.country || 'Unknown'}
Description: ${entityData.description || entityData.primaryServices || 'No description available'}

Please provide:
1. Key strengths and competitive advantages
2. Investment strategy insights
3. Market positioning
4. Potential risks or challenges
5. Notable characteristics or unique aspects

Keep the analysis concise and professional.`;

            const response = await this.openai.chat.completions.create({
                model: this.config.ai.openai.model,
                messages: [
                    { role: 'system', content: 'You are a private markets analyst providing professional insights on investment firms and funds.' },
                    { role: 'user', content: prompt }
                ],
                temperature: this.config.ai.openai.temperature,
                max_tokens: 500
            });

            return {
                analysis: response.choices[0].message.content,
                model: this.config.ai.openai.model,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.warn('Failed to generate AI insights:', error.message);
            return null;
        }
    }

    /**
     * Get engine statistics
     */
    getStats() {
        return {
            ready: this.ready,
            openaiAvailable: !!this.openai,
            entityPatterns: Object.keys(this.entityPatterns).length,
            investmentThemes: this.investmentThemes.length,
            lastUpdated: new Date().toISOString()
        };
    }
}

module.exports = IntelligenceEngine;
