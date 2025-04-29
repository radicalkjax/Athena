import { initializeDatabase } from '../services/database';

/**
 * Initialize the PostgreSQL database
 */
const initDb = async () => {
  try {
    console.log('Initializing database...');
    await initializeDatabase();
    console.log('Database initialized successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
};

// Run the initialization
initDb();
