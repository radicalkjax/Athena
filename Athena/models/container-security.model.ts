import { DataTypes, ModelAttributes } from 'sequelize';
import BaseModel, { baseModelAttributes } from './base.model';
import sequelize from '../config/database';
import { ContainerConfig } from './container-config.model';

// Container security model attributes
export interface ContainerSecurityAttributes {
  id: string;
  readOnlyRootFilesystem: boolean;
  noNewPrivileges: boolean;
  seccomp: boolean;
  appArmor: boolean;
  addressSpaceLayoutRandomization: boolean;
  
  // Windows-specific security options
  windowsDefender?: boolean;
  memoryProtection?: boolean;
  controlFlowGuard?: boolean;
  dataExecutionPrevention?: boolean;
  secureBootEnabled?: boolean;
  hypervisorEnforced?: boolean;
  
  // Linux-specific security options
  selinux?: boolean;
  capabilities?: string;
  seccompProfile?: string;
  privileged?: boolean;
  namespaceIsolation?: boolean;
  cgroupsV2?: boolean;
  restrictSysctls?: boolean;
  
  // macOS-specific security options
  sandboxProfile?: string;
  transparencyConsent?: boolean;
  systemIntegrityProtection?: boolean;
  gatekeeper?: boolean;
  xpcSecurity?: boolean;
  appSandbox?: boolean;
  fileQuarantine?: boolean;
  libraryValidation?: boolean;
  
  configId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

// Container security model class
export class ContainerSecurity extends BaseModel implements ContainerSecurityAttributes {
  public readOnlyRootFilesystem!: boolean;
  public noNewPrivileges!: boolean;
  public seccomp!: boolean;
  public appArmor!: boolean;
  public addressSpaceLayoutRandomization!: boolean;
  
  // Windows-specific security options
  public windowsDefender?: boolean;
  public memoryProtection?: boolean;
  public controlFlowGuard?: boolean;
  public dataExecutionPrevention?: boolean;
  public secureBootEnabled?: boolean;
  public hypervisorEnforced?: boolean;
  
  // Linux-specific security options
  public selinux?: boolean;
  public capabilities?: string;
  public seccompProfile?: string;
  public privileged?: boolean;
  public namespaceIsolation?: boolean;
  public cgroupsV2?: boolean;
  public restrictSysctls?: boolean;
  
  // macOS-specific security options
  public sandboxProfile?: string;
  public transparencyConsent?: boolean;
  public systemIntegrityProtection?: boolean;
  public gatekeeper?: boolean;
  public xpcSecurity?: boolean;
  public appSandbox?: boolean;
  public fileQuarantine?: boolean;
  public libraryValidation?: boolean;
  
  public configId!: string;

  // Association methods
  public getContainerConfig!: () => Promise<ContainerConfig>;
  public setContainerConfig!: (config: ContainerConfig) => Promise<void>;
}

// Container security model attributes definition
const containerSecurityAttributes: ModelAttributes = {
  ...baseModelAttributes,
  readOnlyRootFilesystem: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  noNewPrivileges: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  seccomp: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  appArmor: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  addressSpaceLayoutRandomization: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  
  // Windows-specific security options
  windowsDefender: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
  },
  memoryProtection: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
  },
  controlFlowGuard: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
  },
  dataExecutionPrevention: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
  },
  secureBootEnabled: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
  },
  hypervisorEnforced: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
  },
  
  // Linux-specific security options
  selinux: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
  },
  capabilities: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  seccompProfile: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  privileged: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
  },
  namespaceIsolation: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
  },
  cgroupsV2: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
  },
  restrictSysctls: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
  },
  
  // macOS-specific security options
  sandboxProfile: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  transparencyConsent: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
  },
  systemIntegrityProtection: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
  },
  gatekeeper: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
  },
  xpcSecurity: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
  },
  appSandbox: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
  },
  fileQuarantine: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
  },
  libraryValidation: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
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

// Initialize ContainerSecurity model
ContainerSecurity.init(containerSecurityAttributes, {
  sequelize,
  modelName: 'ContainerSecurity',
  tableName: 'container_securities',
  paranoid: true, // Enable soft deletes
});

export default ContainerSecurity;
