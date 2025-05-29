import { DataTypes, ModelAttributes } from 'sequelize';
import BaseModel, { baseModelAttributes } from './base.model';
import sequelize from '../config/database';
import { Container } from './container.model';

// Container configuration model attributes
export interface ContainerConfigAttributes {
  id: string;
  os: 'windows' | 'linux' | 'macos';
  architecture: 'x86' | 'x64' | 'arm' | 'arm64';
  version: string;
  imageTag?: string;
  distribution?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

// Container configuration model class
export class ContainerConfig extends BaseModel implements ContainerConfigAttributes {
  public os!: 'windows' | 'linux' | 'macos';
  public architecture!: 'x86' | 'x64' | 'arm' | 'arm64';
  public version!: string;
  public imageTag?: string;
  public distribution?: string;

  // Association methods
  public getContainers!: () => Promise<Container[]>;
  public addContainer!: (container: Container) => Promise<void>;
  public hasContainer!: (container: Container) => Promise<boolean>;
  public countContainers!: () => Promise<number>;
}

// Container configuration model attributes definition
const containerConfigAttributes: ModelAttributes = {
  ...baseModelAttributes,
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
    allowNull: true,
  },
  distribution: {
    type: DataTypes.STRING,
    allowNull: true,
  },
};

// Initialize ContainerConfig model
if (sequelize && typeof sequelize.define === 'function') {
  ContainerConfig.init(containerConfigAttributes, {
    sequelize,
    modelName: 'ContainerConfig',
    tableName: 'container_configs',
    paranoid: true, // Enable soft deletes
  });
}

export default ContainerConfig;
