import { DataTypes, ModelAttributes } from 'sequelize';
import BaseModel, { baseModelAttributes } from './base.model';
import sequelize from '../config/database';
import { Container } from './container.model';

// Process activity model attributes
export interface ProcessActivityAttributes {
  id: string;
  containerId: string;
  timestamp: Date;
  processId: number;
  parentProcessId: number;
  processName: string;
  commandLine: string;
  user: string;
  startTime: Date;
  endTime?: Date;
  cpuUsage: number;
  memoryUsage: number;
  status: 'running' | 'stopped' | 'terminated' | 'zombie';
  exitCode?: number;
  isMalicious: boolean;
  maliciousReason?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

// Process activity model class
export class ProcessActivity extends BaseModel implements ProcessActivityAttributes {
  public containerId!: string;
  public timestamp!: Date;
  public processId!: number;
  public parentProcessId!: number;
  public processName!: string;
  public commandLine!: string;
  public user!: string;
  public startTime!: Date;
  public endTime?: Date;
  public cpuUsage!: number;
  public memoryUsage!: number;
  public status!: 'running' | 'stopped' | 'terminated' | 'zombie';
  public exitCode?: number;
  public isMalicious!: boolean;
  public maliciousReason?: string;

  // Association methods
  public getContainer!: () => Promise<Container>;
  public setContainer!: (container: Container) => Promise<void>;
}

// Process activity model attributes definition
const processActivityAttributes: ModelAttributes = {
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
  processId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  parentProcessId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  processName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  commandLine: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  user: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  startTime: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  endTime: {
    type: DataTypes.DATE,
    allowNull: true,
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
  status: {
    type: DataTypes.ENUM('running', 'stopped', 'terminated', 'zombie'),
    allowNull: false,
  },
  exitCode: {
    type: DataTypes.INTEGER,
    allowNull: true,
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
};

// Initialize ProcessActivity model
ProcessActivity.init(processActivityAttributes, {
  sequelize,
  modelName: 'ProcessActivity',
  tableName: 'process_activities',
  paranoid: true, // Enable soft deletes
});

export default ProcessActivity;
