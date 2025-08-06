/**
 * Debug environment loading from agent directory
 */

console.log('Current directory:', __dirname);
console.log('Loading .env from:', require('path').join(__dirname, '../.env'));

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

console.log('\nEnvironment Variables:');
console.log('NEO4J_URI:', process.env.NEO4J_URI);
console.log('NEO4J_USERNAME:', process.env.NEO4J_USERNAME);
console.log('NEO4J_PASSWORD:', process.env.NEO4J_PASSWORD || 'NOT SET');

console.log('\nTesting Neo4j connection directly...');
const neo4j = require('neo4j-driver');

async function testConnection() {
    try {
        console.log(`Connecting to ${process.env.NEO4J_URI} with user ${process.env.NEO4J_USERNAME}`);
        const driver = neo4j.driver(
            process.env.NEO4J_URI,
            neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
        );
        
        await driver.verifyConnectivity();
        console.log('✅ Connection successful!');
        
        await driver.close();
    } catch (error) {
        console.error('❌ Connection failed:', error.message);
    }
}

testConnection();
