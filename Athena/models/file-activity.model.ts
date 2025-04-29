import { DataTypes, ModelAttributes } from 'sequelize';
import BaseModel, { baseModelAttributes } from './base.model';
import sequelize from '../config/database';
import { Container } from './container.model';

// File activity model attributes
export interface FileActivityAttributes {
  id: string;
  containerId: string;
  timestamp: Date;
  operation: 'create' | 'read' | 'write' | 'delete' | 'modify' | 'execute' | 'rename' | 'move';
  filePath: string;
  fileType: 'regular' | 'directory' | 'symlink' | 'device' | 'socket' | 'pipe' | 'unknown';
  fileSize: number;
  filePermissions: string;
  processName: string;
  processId: number;
  isMalicious: boolean;
  maliciousReason?: string;
  fileHash?: string;
  fileContent?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

// File activity model class
export class FileActivity extends BaseModel implements FileActivityAttributes {
  public containerId!: string;
  public timestamp!: Date;
  public operation!: 'create' | 'read' | 'write' | 'delete' | 'modify' | 'execute' | 'rename' | 'move';
  public filePath!: string;
  public fileType!: 'regular' | 'directory' | 'symlink' | 'device' | 'socket' | 'pipe' | 'unknown';
  public fileSize!: number;
  public filePermissions!: string;
  public processName!: string;
  public processId!: number;
  public isMalicious!: boolean;
  public maliciousReason?: string;
  public fileHash?: string;
  public fileContent?: string;

  // Association methods
  public getContainer!: () => Promise<Container>;
  public setContainer!: (container: Container) => Promise<void>;
}

// File activity model attributes definition
const fileActivityAttributes: ModelAttributes = {
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
  operation: {
    type: DataTypes.ENUM('create', 'read', 'write', 'delete', 'modify', 'execute', 'rename', 'move'),
    allowNull: false,
  },
  filePath: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  fileType: {
    type: DataTypes.ENUM('regular', 'directory', 'symlink', 'device', 'socket', 'pipe', 'unknown'),
    allowNull: false,
  },
  fileSize: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  filePermissions: {
    type: DataTypes.STRING,
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
  fileHash: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  fileContent: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
};

// Initialize FileActivity model
FileActivity.init(fileActivityAttributes, {
  sequelize,
  modelName: 'FileActivity',
  tableName: 'file_activities',
  paranoid: true, // Enable soft deletes
});

export default FileActivity;
