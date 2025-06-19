import { vi } from 'vitest';

// Mock DataTypes
export const DataTypes = {
  UUID: 'UUID',
  UUIDV4: 'UUIDV4',
  STRING: 'STRING',
  TEXT: 'TEXT',
  INTEGER: 'INTEGER',
  BOOLEAN: 'BOOLEAN',
  JSON: 'JSON',
  JSONB: 'JSONB',
  DATE: 'DATE',
  ENUM: (...values) => ({ values }),
  ARRAY: (type) => ({ type }),
  DECIMAL: 'DECIMAL',
  FLOAT: 'FLOAT',
  BIGINT: 'BIGINT',
};

// Mock Model class
export class Model {
  static init = vi.fn();
  static associate = vi.fn();
  static belongsTo = vi.fn();
  static hasMany = vi.fn();
  static hasOne = vi.fn();
  static belongsToMany = vi.fn();
  static findAll = vi.fn(() => Promise.resolve([]));
  static findOne = vi.fn(() => Promise.resolve(null));
  static findByPk = vi.fn(() => Promise.resolve(null));
  static create = vi.fn((data) => Promise.resolve(data));
  static update = vi.fn(() => Promise.resolve([1]));
  static destroy = vi.fn(() => Promise.resolve(1));
  static count = vi.fn(() => Promise.resolve(0));
  
  save = vi.fn(() => Promise.resolve(this));
  update = vi.fn((data) => Promise.resolve({ ...this, ...data }));
  destroy = vi.fn(() => Promise.resolve());
  reload = vi.fn(() => Promise.resolve(this));
}

// Mock Sequelize class
export class Sequelize {
  constructor() {
    this.models = {};
    this.authenticate = vi.fn(() => Promise.resolve());
    this.sync = vi.fn(() => Promise.resolve());
    this.close = vi.fn(() => Promise.resolve());
    this.define = vi.fn((modelName, attributes, options) => {
      const MockModel = class extends Model {};
      MockModel.modelName = modelName;
      MockModel.tableName = options?.tableName || modelName;
      this.models[modelName] = MockModel;
      return MockModel;
    });
    this.query = vi.fn(() => Promise.resolve([]));
    this.transaction = vi.fn((callback) => {
      const t = { commit: vi.fn(), rollback: vi.fn() };
      return callback ? callback(t) : Promise.resolve(t);
    });
  }
}

// Export default mock sequelize instance
const sequelizeMock = new Sequelize();

export default sequelizeMock;