/**
 * Seed Data Ingester
 * Handles ingestion of CSV seed data into the knowledge graph
 */

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { v4: uuidv4 } = require('uuid');
const winston = require('winston');

class SeedDataIngester {
    constructor(knowledgeStore, config) {
        this.knowledgeStore = knowledgeStore;
        this.config = config;
        
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.simple(),
            defaultMeta: { service: 'data-ingester' },
            transports: [new winston.transports.Console()]
        });

        // Mapping of file names to entity types
        this.fileTypeMapping = {
            'Infrastructure ++.txt': 'Infrastructure Fund Manager',
            'Private Equity ++.txt': 'Private Equity Firm',
            'Hedge Funds.txt': 'Hedge Fund Manager',
            'Real Estate ++.txt': 'Real Estate Fund Manager',
            'Private Debt ++.txt': 'Private Credit Fund Manager',
            'Natural Resources.txt': 'Natural Resources Fund Manager',
            'Institutional Investors ++.txt': 'Institutional Investor'
        };
    }

    /**
     * Ingest all seed data files
     */
    async ingestAllSeedData() {
        try {
            this.logger.info('🚀 Starting seed data ingestion...');
            
            const seedPath = this.config.data.seedDataPath;
            const files = fs.readdirSync(seedPath);
            
            const results = {
                totalFiles: 0,
                totalEntities: 0,
                successful: 0,
                failed: 0,
                fileResults: {}
            };

            for (const file of files) {
                if (file.endsWith('.txt')) {
                    this.logger.info(`📄 Processing file: ${file}`);
                    
                    const fileResult = await this.ingestFile(path.join(seedPath, file));
                    results.fileResults[file] = fileResult;
                    results.totalFiles++;
                    results.totalEntities += fileResult.totalEntities;
                    results.successful += fileResult.successful;
                    results.failed += fileResult.failed;
                }
            }

            this.logger.info(`✅ Seed data ingestion completed:`);
            this.logger.info(`   📁 Files processed: ${results.totalFiles}`);
            this.logger.info(`   📊 Total entities: ${results.totalEntities}`);
            this.logger.info(`   ✅ Successful: ${results.successful}`);
            this.logger.info(`   ❌ Failed: ${results.failed}`);

            return results;

        } catch (error) {
            this.logger.error('❌ Failed to ingest seed data:', error);
            throw error;
        }
    }

    /**
     * Ingest a single CSV file
     */
    async ingestFile(filePath) {
        return new Promise((resolve, reject) => {
            const fileName = path.basename(filePath);
            const entityType = this.fileTypeMapping[fileName] || 'Unknown';
            
            const results = {
                fileName,
                entityType,
                totalEntities: 0,
                successful: 0,
                failed: 0,
                entities: [],
                errors: []
            };

            const entities = [];
            
            fs.createReadStream(filePath)
                .pipe(csv())
                .on('data', (row) => {
                    try {
                        const entity = this.parseCSVRow(row, entityType);
                        if (entity) {
                            entities.push(entity);
                            results.totalEntities++;
                        }
                    } catch (error) {
                        results.errors.push({
                            row,
                            error: error.message
                        });
                    }
                })
                .on('end', async () => {
                    try {
                        this.logger.info(`📊 Parsed ${results.totalEntities} entities from ${fileName}`);
                        
                        // Batch add entities to knowledge store
                        const batchResults = await this.knowledgeStore.addEntities(entities, {
                            batchSize: 100,
                            inferRelationships: true
                        });

                        results.successful = batchResults.successful.length;
                        results.failed = batchResults.failed.length;
                        results.entities = batchResults.successful;

                        this.logger.info(`✅ ${fileName}: ${results.successful} successful, ${results.failed} failed`);
                        resolve(results);

                    } catch (error) {
                        this.logger.error(`❌ Failed to process ${fileName}:`, error);
                        reject(error);
                    }
                })
                .on('error', (error) => {
                    this.logger.error(`❌ Error reading ${fileName}:`, error);
                    reject(error);
                });
        });
    }

    /**
     * Parse a single CSV row into an entity
     */
    parseCSVRow(row, entityType) {
        const entity = {
            id: uuidv4(),
            type: entityType,
            sourceFile: entityType
        };

        // Handle different column name variations
        const nameFields = ['Name', 'name', 'Company Name', 'Fund Name'];
        const typeFields = ['Type', 'type', 'Type ', 'Strategy', 'Investment Strategies'];
        const aumFields = ['AUM', 'aum', 'AUM_USD', 'Assets Under Management'];
        const countryFields = ['Country', 'country', 'Country ', 'Location'];
        const cityFields = ['City', 'city', 'City ', 'Headquarters'];
        const addressFields = ['Address', 'address', 'Location', 'Headquarters'];
        const foundedFields = ['Founded', 'founded', 'Established', 'Year Founded'];
        const servicesFields = ['Primary Services', 'Services', 'Strategy', 'Focus', 'Investment Strategies'];
        const transactionsFields = ['Notable Transactions', 'Transactions', 'Key Deals', 'Recent Deals'];
        const peopleFields = ['Key People', 'People', 'Leadership', 'Management Team', 'Principals'];

        // Extract fields with flexible column names
        entity.name = this.getFieldValue(row, nameFields);
        entity.subType = this.getFieldValue(row, typeFields);
        entity.aum = this.getFieldValue(row, aumFields);
        entity.country = this.getFieldValue(row, countryFields);
        entity.city = this.getFieldValue(row, cityFields);
        entity.address = this.getFieldValue(row, addressFields);
        entity.founded = this.getFieldValue(row, foundedFields);
        entity.primaryServices = this.getFieldValue(row, servicesFields);
        entity.notableTransactions = this.getFieldValue(row, transactionsFields);
        entity.keyPeople = this.getFieldValue(row, peopleFields);

        // Additional processing
        entity.status = this.getFieldValue(row, ['Status', 'status']) || 'Active';
        
        // Build description from available fields
        const descriptionParts = [];
        if (entity.primaryServices) descriptionParts.push(entity.primaryServices);
        if (entity.subType && entity.subType !== entity.type) descriptionParts.push(`Type: ${entity.subType}`);
        if (entity.country) descriptionParts.push(`Location: ${entity.country}`);
        if (entity.founded) descriptionParts.push(`Founded: ${entity.founded}`);
        
        entity.description = descriptionParts.join('. ');

        // Validate required fields
        if (!entity.name || entity.name.trim() === '') {
            throw new Error('Entity name is required');
        }

        // Clean up fields
        entity.name = entity.name.trim();
        if (entity.description) entity.description = entity.description.trim();

        // Parse AUM to numeric value if present
        if (entity.aum) {
            entity.aumNumeric = this.parseAUM(entity.aum);
        }

        // Extract sector from type or services
        entity.sector = this.extractSector(entity.type, entity.primaryServices, entity.subType);

        return entity;
    }

    /**
     * Get field value with flexible column name matching
     */
    getFieldValue(row, fieldNames) {
        for (const fieldName of fieldNames) {
            if (row[fieldName] !== undefined && row[fieldName] !== null && row[fieldName].trim() !== '') {
                return row[fieldName].trim();
            }
        }
        return null;
    }

    /**
     * Parse AUM string to numeric value
     */
    parseAUM(aumStr) {
        if (!aumStr || typeof aumStr !== 'string') return 0;

        // Remove quotes, currency symbols, and clean up
        let cleaned = aumStr.replace(/["$,€£¥]/g, '').trim();
        
        // Handle different formats
        const multipliers = {
            'trillion': 1e12,
            'billion': 1e9,
            'million': 1e6,
            'thousand': 1e3,
            't': 1e12,
            'b': 1e9,
            'm': 1e6,
            'k': 1e3
        };

        // Check for multipliers
        for (const [suffix, multiplier] of Object.entries(multipliers)) {
            const regex = new RegExp(`\\b${suffix}\\b`, 'i');
            if (regex.test(cleaned)) {
                const number = parseFloat(cleaned.replace(regex, ''));
                return isNaN(number) ? 0 : number * multiplier;
            }
        }

        // Try direct parse
        const number = parseFloat(cleaned);
        return isNaN(number) ? 0 : number;
    }

    /**
     * Extract sector information
     */
    extractSector(type, services, subType) {
        const text = [type, services, subType].join(' ').toLowerCase();

        const sectorKeywords = {
            'Infrastructure': ['infrastructure', 'utilities', 'transportation', 'energy', 'renewable'],
            'Private Equity': ['private equity', 'buyout', 'growth capital'],
            'Hedge Funds': ['hedge fund', 'alternative', 'quantitative', 'long short'],
            'Real Estate': ['real estate', 'property', 'reit', 'commercial', 'residential'],
            'Private Credit': ['private credit', 'debt', 'lending', 'credit', 'fixed income'],
            'Natural Resources': ['natural resources', 'commodities', 'oil', 'gas', 'mining', 'energy'],
            'Venture Capital': ['venture capital', 'startup', 'early stage', 'growth'],
            'Asset Management': ['asset management', 'investment management', 'portfolio management']
        };

        for (const [sector, keywords] of Object.entries(sectorKeywords)) {
            if (keywords.some(keyword => text.includes(keyword))) {
                return sector;
            }
        }

        return 'Other';
    }

    /**
     * Get ingestion statistics
     */
    async getIngestionStats() {
        try {
            const stats = await this.knowledgeStore.getStats();
            return {
                totalEntities: stats.totalEntities || 0,
                totalRelationships: stats.totalRelationships || 0,
                entityTypeBreakdown: stats.entityTypeBreakdown || [],
                lastIngestion: new Date().toISOString()
            };
        } catch (error) {
            this.logger.error('Failed to get ingestion stats:', error);
            return null;
        }
    }
}

module.exports = SeedDataIngester;
