import sequelize from '../config/database';
import Container from './container.model';
import ContainerConfig from './container-config.model';
import ContainerResource from './container-resource.model';
import ContainerSecurity from './container-security.model';
import ContainerMonitoring from './container-monitoring.model';
import NetworkActivity from './network-activity.model';
import FileActivity from './file-activity.model';
import ProcessActivity from './process-activity.model';

// Set up associations between models

// Container Config has one-to-many relationship with Container
ContainerConfig.hasMany(Container, {
  foreignKey: 'configId',
  as: 'containers',
});
Container.belongsTo(ContainerConfig, {
  foreignKey: 'configId',
  as: 'config',
});

// Container Config has one-to-one relationship with Container Resource
ContainerConfig.hasOne(ContainerResource, {
  foreignKey: 'configId',
  as: 'resources',
});
ContainerResource.belongsTo(ContainerConfig, {
  foreignKey: 'configId',
  as: 'config',
});

// Container Config has one-to-one relationship with Container Security
ContainerConfig.hasOne(ContainerSecurity, {
  foreignKey: 'configId',
  as: 'security',
});
ContainerSecurity.belongsTo(ContainerConfig, {
  foreignKey: 'configId',
  as: 'config',
});

// Container has one-to-many relationship with Container Monitoring
Container.hasMany(ContainerMonitoring, {
  foreignKey: 'containerId',
  as: 'monitorings',
});
ContainerMonitoring.belongsTo(Container, {
  foreignKey: 'containerId',
  as: 'container',
});

// Container has one-to-many relationship with Network Activity
Container.hasMany(NetworkActivity, {
  foreignKey: 'containerId',
  as: 'networkActivities',
});
NetworkActivity.belongsTo(Container, {
  foreignKey: 'containerId',
  as: 'container',
});

// Container has one-to-many relationship with File Activity
Container.hasMany(FileActivity, {
  foreignKey: 'containerId',
  as: 'fileActivities',
});
FileActivity.belongsTo(Container, {
  foreignKey: 'containerId',
  as: 'container',
});

// Container has one-to-many relationship with Process Activity
Container.hasMany(ProcessActivity, {
  foreignKey: 'containerId',
  as: 'processActivities',
});
ProcessActivity.belongsTo(Container, {
  foreignKey: 'containerId',
  as: 'container',
});

// Export all models
export {
  sequelize,
  Container,
  ContainerConfig,
  ContainerResource,
  ContainerSecurity,
  ContainerMonitoring,
  NetworkActivity,
  FileActivity,
  ProcessActivity,
};

// Function to initialize the database
export const initDatabase = async (): Promise<void> => {
  try {
    // Sync all models with the database
    await sequelize.sync({ alter: true });
    console.log('Database synchronized successfully');
  } catch (error) {
    console.error('Error synchronizing database:', error);
    throw error;
  }
};

// Export default object with all models and initialization function
export default {
  sequelize,
  Container,
  ContainerConfig,
  ContainerResource,
  ContainerSecurity,
  ContainerMonitoring,
  NetworkActivity,
  FileActivity,
  ProcessActivity,
  initDatabase,
};
