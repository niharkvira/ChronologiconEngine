const fs = require('fs').promises;
const path = require('path');
const pool = require('../config/database');
const logger = require('../config/logger');
const QUERIES = require('../config/queries');

async function runMigration() {
  try {
    logger.info('Starting database migration...');
    
    // Read the SQL schema file
    const schemaPath = path.join(__dirname, '../../database_schema.sql');
    const schemaSql = await fs.readFile(schemaPath, 'utf8');
    
    // Split the SQL into individual statements
    const statements = schemaSql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    // Execute each statement
    for (const statement of statements) {
      try {
        if (statement.trim()) {
          await pool.query(statement);
          logger.info(`Executed: ${statement.substring(0, 50)}...`);
        }
      } catch (error) {
        // Log warning for statements that might already exist
        if (error.code === '42P07' || error.code === '42710') {
          logger.warn(`Statement already exists (skipping): ${error.message}`);
        } else {
          throw error;
        }
      }
    }
    
    logger.info('Database migration completed successfully!');
    
    // Test the connection
    const testResult = await pool.query(QUERIES.MIGRATION.TEST_CONNECTION);
    logger.info(`Database connection test successful. Current time: ${testResult.rows[0].current_time}`);
    
    // Check if tables were created
    const tablesResult = await pool.query(QUERIES.MIGRATION.CHECK_TABLES);
    
    logger.info('Created tables:', tablesResult.rows.map(row => row.table_name));
    
  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run migration if called directly
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('✅ Database migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error.message);
      process.exit(1);
    });
}

module.exports = { runMigration };
