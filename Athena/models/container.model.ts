import { DataTypes, ModelAttributes } from 'sequelize';
import BaseModel, { baseModelAttributes } from './base.model';
import sequelize from '../config/database';

// Container model attributes
export interface ContainerAttributes {
  id: string;
  status: 'creating' | 'running' | 'stopped' | 'error';
  malwareId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  error?: string;
  os: 'windows' | 'linux' | 'macos';
  architecture: 'x86' | 'x64' | 'arm' | 'arm64';
  version: string;
  imageTag: string;
  distribution?: string;
  configId: string;
}

// Container model class
export class Container extends BaseModel implements ContainerAttributes {
  public status!: 'creating' | 'running' | 'stopped' | 'error';
  public malwareId!: string;
  public error?: string;
  public os!: 'windows' | 'linux' | 'macos';
  public architecture!: 'x86' | 'x64' | 'arm' | 'arm64';
  public version!: string;
  public imageTag!: string;
  public distribution?: string;
  public configId!: string;
}

// Container model attributes definition
const containerAttributes: ModelAttributes = {
  ...baseModelAttributes,
  status: {
    type: DataTypes.ENUM('creating', 'running', 'stopped', 'error'),
    allowNull: false,
    defaultValue: 'creating',
  },
  malwareId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  error: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  os: {
    type: DataTypes.ENUM('windows', 'linux', 'macos'),
    allowNull: false,
  },
  architecture: {
    type: DataTypes.ENUM('x86', 'x64', 'arm', 'arm64'),
    allowNull: false,
  },
  version: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  imageTag: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  distribution: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  configId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
};

// Initialize Container model only if sequelize is properly initialized
if (sequelize && typeof sequelize.define === 'function') {
  Container.init(containerAttributes, {
    sequelize,
    modelName: 'Container',
    tableName: 'containers',
    paranoid: true, // Enable soft deletes
  });
}

export default Container;
