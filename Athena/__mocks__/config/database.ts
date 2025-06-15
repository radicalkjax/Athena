// Mock database configuration for testing
const mockSequelize = {
  authenticate: jest.fn().mockResolvedValue(true),
  sync: jest.fn().mockResolvedValue(true),
  define: jest.fn().mockReturnValue({
    init: jest.fn(),
    belongsTo: jest.fn(),
    hasMany: jest.fn(),
    create: jest.fn(),
    findAll: jest.fn(),
    findByPk: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn(),
  }),
  transaction: jest.fn().mockImplementation(async (callback) => {
    const mockTransaction = {
      commit: jest.fn(),
      rollback: jest.fn(),
    };
    try {
      const result = await callback(mockTransaction);
      return result;
    } catch (error: unknown) {
      throw error;
    }
  }),
  DataTypes: {
    UUID: 'UUID',
    STRING: 'STRING',
    INTEGER: 'INTEGER',
    FLOAT: 'FLOAT',
    BOOLEAN: 'BOOLEAN',
    DATE: 'DATE',
    TEXT: 'TEXT',
    JSON: 'JSON',
    ENUM: jest.fn((...values) => ({ values })),
  },
  Model: class MockModel {
    static init = jest.fn();
    static belongsTo = jest.fn();
    static hasMany = jest.fn();
    static create = jest.fn();
    static findAll = jest.fn();
    static findByPk = jest.fn();
    static update = jest.fn();
    static destroy = jest.fn();
  },
};

export const testConnection = jest.fn().mockResolvedValue(true);
export default mockSequelize;