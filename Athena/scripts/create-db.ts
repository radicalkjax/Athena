import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

/**
 * Create the PostgreSQL database
 */
const createDb = async () => {
  // Get database configuration from environment variables
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: 'postgres', // Connect to default postgres database
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  };

  const dbName = process.env.DB_NAME || 'athena_db';

  // Create a client to connect to the default postgres database
  const client = new Client(dbConfig);

  try {
    // Connect to the default postgres database
    await client.connect();
    console.log('Connected to PostgreSQL server');

    // Check if the database already exists
    const checkResult = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [dbName]
    );

    if (checkResult.rowCount === 0) {
      // Create the database if it doesn't exist
      console.log(`Creating database: ${dbName}`);
      await client.query(`CREATE DATABASE ${dbName}`);
      console.log(`Database ${dbName} created successfully`);
    } else {
      console.log(`Database ${dbName} already exists`);
    }

    // Disconnect from the default postgres database
    await client.end();
    console.log('Disconnected from PostgreSQL server');
    process.exit(0);
  } catch (error: unknown) {
    console.error('Error creating database:', error);
    process.exit(1);
  }
};

// Run the database creation
createDb();
