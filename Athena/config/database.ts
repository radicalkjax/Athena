// Browser compatibility check
let sequelize: any;
let testConnection: () => Promise<boolean>;

if (typeof window !== 'undefined') {
  // Browser environment - export mock objects to prevent errors
  testConnection = async (): Promise<boolean> => {
    console.warn('Database operations are not available in browser environment');
    return false;
  };

  // Mock Sequelize instance for browser
  sequelize = {
    authenticate: async () => { throw new Error('Database not available in browser'); },
    sync: async () => { throw new Error('Database not available in browser'); },
    define: () => { throw new Error('Database not available in browser'); },
  };
} else {
  // Node.js environment
  const { Sequelize } = require('sequelize-typescript');
  const dotenv = require('dotenv');
  const path = require('path');

  // Load environment variables
  dotenv.config({ path: path.resolve(__dirname, '../.env') });

  // Database configuration
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'athena_db',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    dialect: process.env.DB_DIALECT || 'postgres',
  };

  // Create Sequelize instance
  sequelize = new Sequelize({
    host: dbConfig.host,
    port: dbConfig.port,
    database: dbConfig.database,
    username: dbConfig.username,
    password: dbConfig.password,
    dialect: dbConfig.dialect as 'postgres',
    logging: false, // Set to console.log to see SQL queries
    define: {
      timestamps: true, // Add createdAt and updatedAt timestamps to every model
    },
  });

  // Test database connection
  testConnection = async (): Promise<boolean> => {
    try {
      await sequelize.authenticate();
      console.log('Database connection has been established successfully.');
      return true;
    } catch (error: unknown) {
      console.error('Unable to connect to the database:', error);
      return false;
    }
  };
}

export { testConnection };
export default sequelize;
