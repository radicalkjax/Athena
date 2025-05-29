import { DataTypes, ModelAttributes } from 'sequelize';
import BaseModel, { baseModelAttributes } from './base.model';
import sequelize from '../config/database';
import { ContainerConfig } from './container-config.model';

// Container resource model attributes
export interface ContainerResourceAttributes {
  id: string;
  cpu: number;
  memory: number;
  diskSpace: number;
  networkSpeed: number;
  ioOperations: number;
  configId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

// Container resource model class
export class ContainerResource extends BaseModel implements ContainerResourceAttributes {
  public cpu!: number;
  public memory!: number;
  public diskSpace!: number;
  public networkSpeed!: number;
  public ioOperations!: number;
  public configId!: string;

  // Association methods
  public getContainerConfig!: () => Promise<ContainerConfig>;
  public setContainerConfig!: (config: ContainerConfig) => Promise<void>;
}

// Container resource model attributes definition
const containerResourceAttributes: ModelAttributes = {
  ...baseModelAttributes,
  cpu: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 1,
  },
  memory: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 2048,
  },
  diskSpace: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 5120,
  },
  networkSpeed: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 10,
  },
  ioOperations: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1000,
  },
  configId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'container_configs',
      key: 'id',
    },
  },
};

// Initialize ContainerResource model
if (sequelize && typeof sequelize.define === 'function') {
  ContainerResource.init(containerResourceAttributes, {
    sequelize,
    modelName: 'ContainerResource',
    tableName: 'container_resources',
    paranoid: true, // Enable soft deletes
  });
}

export default ContainerResource;
