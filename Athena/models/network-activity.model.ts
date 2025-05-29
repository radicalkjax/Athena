import { DataTypes, ModelAttributes } from 'sequelize';
import BaseModel, { baseModelAttributes } from './base.model';
import sequelize from '../config/database';
import { Container } from './container.model';

// Network activity model attributes
export interface NetworkActivityAttributes {
  id: string;
  containerId: string;
  timestamp: Date;
  protocol: 'tcp' | 'udp' | 'icmp' | 'http' | 'https' | 'dns' | 'other';
  sourceIp: string;
  sourcePort: number;
  destinationIp: string;
  destinationPort: number;
  direction: 'inbound' | 'outbound';
  dataSize: number;
  duration: number;
  status: 'established' | 'closed' | 'blocked' | 'attempted';
  processName: string;
  processId: number;
  isMalicious: boolean;
  maliciousReason?: string;
  payload?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

// Network activity model class
export class NetworkActivity extends BaseModel implements NetworkActivityAttributes {
  public containerId!: string;
  public timestamp!: Date;
  public protocol!: 'tcp' | 'udp' | 'icmp' | 'http' | 'https' | 'dns' | 'other';
  public sourceIp!: string;
  public sourcePort!: number;
  public destinationIp!: string;
  public destinationPort!: number;
  public direction!: 'inbound' | 'outbound';
  public dataSize!: number;
  public duration!: number;
  public status!: 'established' | 'closed' | 'blocked' | 'attempted';
  public processName!: string;
  public processId!: number;
  public isMalicious!: boolean;
  public maliciousReason?: string;
  public payload?: string;

  // Association methods
  public getContainer!: () => Promise<Container>;
  public setContainer!: (container: Container) => Promise<void>;
}

// Network activity model attributes definition
const networkActivityAttributes: ModelAttributes = {
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
  protocol: {
    type: DataTypes.ENUM('tcp', 'udp', 'icmp', 'http', 'https', 'dns', 'other'),
    allowNull: false,
  },
  sourceIp: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  sourcePort: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  destinationIp: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  destinationPort: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  direction: {
    type: DataTypes.ENUM('inbound', 'outbound'),
    allowNull: false,
  },
  dataSize: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  duration: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  status: {
    type: DataTypes.ENUM('established', 'closed', 'blocked', 'attempted'),
    allowNull: false,
  },
  processName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  processId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  isMalicious: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  maliciousReason: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  payload: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
};

// Initialize NetworkActivity model
if (sequelize && typeof sequelize.define === 'function') {
  NetworkActivity.init(networkActivityAttributes, {
    sequelize,
    modelName: 'NetworkActivity',
    tableName: 'network_activities',
    paranoid: true, // Enable soft deletes
  });
}

export default NetworkActivity;
