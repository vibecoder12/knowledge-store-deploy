/**
 * Graph Database interface for Neo4j
 * Handles all graph operations for the Private Markets Knowledge Store
 */

const neo4j = require('neo4j-driver');
const winston = require('winston');

class GraphDatabase {
    constructor(config) {
        this.config = config;
        this.driver = null;
        this.session = null;
        this.connected = false;
        
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.simple(),
            defaultMeta: { service: 'graph-db' },
            transports: [new winston.transports.Console()]
        });
    }

    async connect() {
        try {
            this.logger.info('Connecting to Neo4j database...');
            
            this.driver = neo4j.driver(
                this.config.uri,
                neo4j.auth.basic(this.config.username, this.config.password),
                {
                    maxConnectionPoolSize: this.config.maxConnectionPoolSize || 50,
                    connectionTimeout: this.config.connectionTimeout || 30000,
                    disableLosslessIntegers: true
                }
            );

            // Test the connection
            await this.driver.verifyConnectivity();
            this.connected = true;
            
            // Initialize constraints and indexes
            await this.initializeSchema();
            
            this.logger.info('✅ Successfully connected to Neo4j');
            
        } catch (error) {
            this.logger.error('❌ Failed to connect to Neo4j:', error);
            throw error;
        }
    }

    async disconnect() {
        if (this.session) {
            await this.session.close();
        }
        if (this.driver) {
            await this.driver.close();
        }
        this.connected = false;
        this.logger.info('Disconnected from Neo4j');
    }

    isConnected() {
        return this.connected;
    }

    getSession() {
        if (!this.driver || !this.connected) {
            throw new Error('Database not connected');
        }
        return this.driver.session();
    }

    async initializeSchema() {
        const session = this.getSession();
        
        try {
            this.logger.info('Initializing database schema...');

            // Create constraints for unique entities
            const constraints = [
                'CREATE CONSTRAINT entity_id_unique IF NOT EXISTS FOR (e:Entity) REQUIRE e.id IS UNIQUE',
                'CREATE CONSTRAINT company_name_unique IF NOT EXISTS FOR (c:Company) REQUIRE c.name IS UNIQUE',
                'CREATE CONSTRAINT fund_name_unique IF NOT EXISTS FOR (f:Fund) REQUIRE f.name IS UNIQUE',
                'CREATE CONSTRAINT person_name_unique IF NOT EXISTS FOR (p:Person) REQUIRE p.name IS UNIQUE',
                'CREATE CONSTRAINT transaction_id_unique IF NOT EXISTS FOR (t:Transaction) REQUIRE t.id IS UNIQUE'
            ];

            for (const constraint of constraints) {
                try {
                    await session.run(constraint);
                } catch (error) {
                    // Constraint might already exist
                    if (!error.message.includes('already exists')) {
                        this.logger.warn(`Failed to create constraint: ${constraint}`, error);
                    }
                }
            }

            // Create indexes for performance
            const indexes = [
                'CREATE INDEX entity_type_index IF NOT EXISTS FOR (e:Entity) ON (e.type)',
                'CREATE INDEX entity_name_index IF NOT EXISTS FOR (e:Entity) ON (e.name)',
                'CREATE INDEX entity_sector_index IF NOT EXISTS FOR (e:Entity) ON (e.sector)',
                'CREATE INDEX entity_country_index IF NOT EXISTS FOR (e:Entity) ON (e.country)',
                'CREATE INDEX entity_aum_index IF NOT EXISTS FOR (e:Entity) ON (e.aum)',
                'CREATE TEXT INDEX entity_name_text IF NOT EXISTS FOR (e:Entity) ON (e.name)',
                'CREATE TEXT INDEX entity_description_text IF NOT EXISTS FOR (e:Entity) ON (e.description)'
            ];

            for (const index of indexes) {
                try {
                    await session.run(index);
                } catch (error) {
                    if (!error.message.includes('already exists')) {
                        this.logger.warn(`Failed to create index: ${index}`, error);
                    }
                }
            }

            this.logger.info('✅ Database schema initialized');

        } catch (error) {
            this.logger.error('❌ Failed to initialize schema:', error);
            throw error;
        } finally {
            await session.close();
        }
    }

    async createEntity(entityData) {
        const session = this.getSession();
        
        try {
            // Serialize complex objects to JSON strings
            const serializedData = this.serializeEntityData(entityData);
            
            const query = `
                MERGE (e:Entity {id: $id})
                ON CREATE SET 
                    e.name = $name,
                    e.type = $type,
                    e.created = datetime(),
                    e.updated = datetime()
                ON MATCH SET 
                    e.updated = datetime()
                SET e += $properties
                RETURN e
            `;

            const result = await session.run(query, {
                id: serializedData.id,
                name: serializedData.name,
                type: serializedData.type,
                properties: serializedData
            });

            return result.records[0]?.get('e').properties;

        } catch (error) {
            this.logger.error('Failed to create entity:', error);
            throw error;
        } finally {
            await session.close();
        }
    }

    async createRelationship(fromId, toId, relationshipType, properties = {}) {
        const session = this.getSession();
        
        try {
            const query = `
                MATCH (from:Entity {id: $fromId})
                MATCH (to:Entity {id: $toId})
                MERGE (from)-[r:${relationshipType}]->(to)
                ON CREATE SET 
                    r.created = datetime(),
                    r.updated = datetime(),
                    r.confidence = $confidence,
                    r.weight = $weight
                ON MATCH SET 
                    r.updated = datetime(),
                    r.confidence = CASE 
                        WHEN $confidence > r.confidence THEN $confidence 
                        ELSE r.confidence 
                    END
                SET r += $properties
                RETURN r
            `;

            const result = await session.run(query, {
                fromId,
                toId,
                confidence: properties.confidence || 0.5,
                weight: properties.weight || 1.0,
                properties
            });

            return result.records[0]?.get('r').properties;

        } catch (error) {
            this.logger.error('Failed to create relationship:', error);
            throw error;
        } finally {
            await session.close();
        }
    }

    async findEntities(filters = {}, limit = 100) {
        const session = this.getSession();
        
        try {
            let query = 'MATCH (e:Entity)';
            const conditions = [];
            const parameters = { limit: neo4j.int(Math.floor(limit)) };

            if (filters.type) {
                conditions.push('e.type = $type');
                parameters.type = filters.type;
            }

            if (filters.name) {
                conditions.push('e.name CONTAINS $name');
                parameters.name = filters.name;
            }

            if (filters.sector) {
                conditions.push('e.sector = $sector');
                parameters.sector = filters.sector;
            }

            if (filters.country) {
                conditions.push('e.country = $country');
                parameters.country = filters.country;
            }

            if (filters.minAum) {
                conditions.push('e.aum >= $minAum');
                parameters.minAum = filters.minAum;
            }

            if (conditions.length > 0) {
                query += ' WHERE ' + conditions.join(' AND ');
            }

            query += ' RETURN e LIMIT $limit';

            const result = await session.run(query, parameters);
            return result.records.map(record => record.get('e').properties);

        } catch (error) {
            this.logger.error('Failed to find entities:', error);
            throw error;
        } finally {
            await session.close();
        }
    }

    async findRelationships(entityId, relationshipType = null, direction = 'both') {
        const session = this.getSession();
        
        try {
            let query;
            const parameters = { entityId };

            if (direction === 'outgoing') {
                query = 'MATCH (e:Entity {id: $entityId})-[r]->(other:Entity)';
            } else if (direction === 'incoming') {
                query = 'MATCH (e:Entity {id: $entityId})<-[r]-(other:Entity)';
            } else {
                query = 'MATCH (e:Entity {id: $entityId})-[r]-(other:Entity)';
            }

            if (relationshipType) {
                query = query.replace('[r]', `[r:${relationshipType}]`);
            }

            query += ' RETURN type(r) as relationshipType, r, other ORDER BY r.confidence DESC, r.weight DESC';

            const result = await session.run(query, parameters);
            
            return result.records.map(record => ({
                type: record.get('relationshipType'),
                relationship: record.get('r').properties,
                entity: record.get('other').properties
            }));

        } catch (error) {
            this.logger.error('Failed to find relationships:', error);
            throw error;
        } finally {
            await session.close();
        }
    }

    async executeCustomQuery(query, parameters = {}) {
        const session = this.getSession();
        
        try {
            this.logger.debug(`Executing query: ${query}`, parameters);
            const result = await session.run(query, parameters);
            
            return {
                records: result.records.map(record => {
                    const obj = {};
                    record.keys.forEach(key => {
                        const value = record.get(key);
                        obj[key] = value?.properties || value;
                    });
                    return obj;
                }),
                summary: result.summary
            };

        } catch (error) {
            this.logger.error('Failed to execute custom query:', error);
            throw error;
        } finally {
            await session.close();
        }
    }

    async getGraphStats() {
        const session = this.getSession();
        
        try {
            const queries = {
                totalEntities: 'MATCH (e:Entity) RETURN count(e) as count',
                totalRelationships: 'MATCH ()-[r]->() RETURN count(r) as count',
                entityTypeBreakdown: 'MATCH (e:Entity) RETURN e.type as type, count(e) as count ORDER BY count DESC',
                relationshipTypeBreakdown: 'MATCH ()-[r]->() RETURN type(r) as type, count(r) as count ORDER BY count DESC',
                topEntitiesByConnections: `
                    MATCH (e:Entity)-[r]-()
                    RETURN e.name as name, e.type as type, count(r) as connections
                    ORDER BY connections DESC
                    LIMIT 10
                `
            };

            const stats = {};
            
            for (const [key, query] of Object.entries(queries)) {
                const result = await session.run(query);
                if (key.includes('Breakdown')) {
                    stats[key] = result.records.map(record => ({
                        type: record.get('type'),
                        count: Number(record.get('count'))
                    }));
                } else if (key.includes('topEntities')) {
                    stats[key] = result.records.map(record => ({
                        name: record.get('name'),
                        type: record.get('type'),
                        count: Number(record.get('connections'))
                    }));
                } else {
                    stats[key] = Number(result.records[0]?.get('count')) || 0;
                }
            }

            return stats;

        } catch (error) {
            this.logger.error('Failed to get graph stats:', error);
            throw error;
        } finally {
            await session.close();
        }
    }

    async findSimilarEntities(entityId, similarity = 0.7, limit = 10) {
        const session = this.getSession();
        
        try {
            // Find entities with similar properties and relationships
            const query = `
                MATCH (target:Entity {id: $entityId})
                MATCH (similar:Entity)
                WHERE target <> similar AND target.type = similar.type
                
                // Calculate similarity based on shared relationships and properties
                OPTIONAL MATCH (target)-[tr]-(shared:Entity)-[sr]-(similar)
                WITH target, similar, count(DISTINCT shared) as sharedConnections
                
                // Calculate property similarity
                WITH target, similar, sharedConnections,
                     CASE 
                         WHEN target.sector = similar.sector THEN 1 
                         ELSE 0 
                     END +
                     CASE 
                         WHEN target.country = similar.country THEN 1 
                         ELSE 0 
                     END as propertySimilarity
                
                WITH target, similar, 
                     (sharedConnections * 0.7 + propertySimilarity * 0.3) as similarityScore
                
                WHERE similarityScore >= $similarity
                
                RETURN similar, similarityScore
                ORDER BY similarityScore DESC
                LIMIT $limit
            `;

            const result = await session.run(query, {
                entityId,
                similarity,
                limit: neo4j.int(Math.floor(limit))
            });

            return result.records.map(record => ({
                entity: record.get('similar').properties,
                similarity: record.get('similarityScore')
            }));

        } catch (error) {
            this.logger.error('Failed to find similar entities:', error);
            throw error;
        } finally {
            await session.close();
        }
    }

    async findShortestPath(fromId, toId, maxHops = 6) {
        const session = this.getSession();
        
        try {
            const query = `
                MATCH (from:Entity {id: $fromId}), (to:Entity {id: $toId})
                MATCH path = shortestPath((from)-[*1..${maxHops}]-(to))
                RETURN path, length(path) as pathLength
                ORDER BY pathLength
                LIMIT 1
            `;

            const result = await session.run(query, { fromId, toId });
            
            if (result.records.length === 0) {
                return null;
            }

            const path = result.records[0].get('path');
            const pathLength = Number(result.records[0].get('pathLength'));

            // Extract nodes and relationships from path
            const nodes = path.segments.map(segment => segment.start.properties);
            nodes.push(path.segments[path.segments.length - 1].end.properties);

            const relationships = path.segments.map(segment => ({
                type: segment.relationship.type,
                properties: segment.relationship.properties
            }));

            return {
                nodes,
                relationships,
                pathLength
            };

        } catch (error) {
            this.logger.error('Failed to find shortest path:', error);
            throw error;
        } finally {
            await session.close();
        }
    }

    async clearDatabase() {
        const session = this.getSession();
        
        try {
            this.logger.warn('⚠️  Clearing entire database...');
            await session.run('MATCH (n) DETACH DELETE n');
            this.logger.info('✅ Database cleared');

        } catch (error) {
            this.logger.error('Failed to clear database:', error);
            throw error;
        } finally {
            await session.close();
        }
    }

    /**
     * Serialize complex objects for Neo4j storage
     */
    serializeEntityData(entityData) {
        const serialized = { ...entityData };
        
        // Convert complex objects to JSON strings and ensure proper types
        for (const [key, value] of Object.entries(serialized)) {
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                if (value instanceof Date) {
                    serialized[key] = value.toISOString();
                } else {
                    serialized[key] = JSON.stringify(value);
                }
            } else if (Array.isArray(value)) {
                // Handle arrays of objects
                if (value.length > 0 && typeof value[0] === 'object') {
                    serialized[key] = JSON.stringify(value);
                } else {
                    // Keep primitive arrays as is
                    serialized[key] = value;
                }
            } else if (typeof value === 'number' && !Number.isInteger(value)) {
                // Keep floats as floats, but ensure they're proper numbers
                serialized[key] = Number(value);
            }
        }
        
        return serialized;
    }
}

module.exports = GraphDatabase;
