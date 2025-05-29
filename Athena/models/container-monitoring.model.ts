import { DataTypes, ModelAttributes } from 'sequelize';
import BaseModel, { baseModelAttributes } from './base.model';
import sequelize from '../config/database';
import { Container } from './container.model';

// Container monitoring model attributes
export interface ContainerMonitoringAttributes {
  id: string;
  containerId: string;
  timestamp: Date;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkInbound: number;
  networkOutbound: number;
  processCount: number;
  openFileCount: number;
  openSocketCount: number;
  suspiciousActivities: string[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

// Container monitoring model class
export class ContainerMonitoring extends BaseModel implements ContainerMonitoringAttributes {
  public containerId!: string;
  public timestamp!: Date;
  public cpuUsage!: number;
  public memoryUsage!: number;
  public diskUsage!: number;
  public networkInbound!: number;
  public networkOutbound!: number;
  public processCount!: number;
  public openFileCount!: number;
  public openSocketCount!: number;
  public suspiciousActivities!: string[];

  // Association methods
  public getContainer!: () => Promise<Container>;
  public setContainer!: (container: Container) => Promise<void>;
}

// Container monitoring model attributes definition
const containerMonitoringAttributes: ModelAttributes = {
  ...baseModelAttributes,
  containerId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'containers',
      key: 'id',
    },
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  cpuUsage: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0,
  },
  memoryUsage: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  diskUsage: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  networkInbound: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  networkOutbound: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  processCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  openFileCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  openSocketCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  suspiciousActivities: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    allowNull: false,
    defaultValue: [],
  },
};

// Initialize ContainerMonitoring model
if (sequelize && typeof sequelize.define === 'function') {
  ContainerMonitoring.init(containerMonitoringAttributes, {
    sequelize,
    modelName: 'ContainerMonitoring',
    tableName: 'container_monitorings',
    paranoid: true, // Enable soft deletes
  });
}

export default ContainerMonitoring;
