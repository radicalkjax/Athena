import { vi } from 'vitest';

// Mock sequelize instance
export const sequelize = null; // Set to null to prevent model initialization in tests

export default {
  sequelize,
  development: {
    dialect: 'postgres',
    host: 'localhost',
    port: 5432,
    database: 'test_db',
    username: 'test',
    password: 'test',
  },
  test: {
    dialect: 'postgres',
    host: 'localhost',
    port: 5432,
    database: 'test_db',
    username: 'test',
    password: 'test',
  },
  production: {
    dialect: 'postgres',
    host: 'localhost',
    port: 5432,
    database: 'test_db',
    username: 'test',
    password: 'test',
  }
};