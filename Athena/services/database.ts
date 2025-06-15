import { initDatabase, Container, ContainerConfig, ContainerResource, ContainerSecurity } from '../models';
import { ContainerConfigAttributes } from '../models/container-config.model';
import { ContainerResourceAttributes } from '../models/container-resource.model';
import { ContainerSecurityAttributes } from '../models/container-security.model';
import { ContainerAttributes } from '../models/container.model';
import { v4 as uuidv4 } from 'uuid';

/**
 * Initialize the database
 * @returns Promise<void>
 */
export const initializeDatabase = async (): Promise<void> => {
  try {
    await initDatabase();
    console.log('Database initialized successfully');
  } catch (error: unknown) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

/**
 * Create a container configuration
 * @param config Container configuration
 * @param resources Container resources
 * @param security Container security options
 * @returns Promise<ContainerConfig>
 */
export const createContainerConfig = async (
  config: Omit<ContainerConfigAttributes, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>,
  resources: Omit<ContainerResourceAttributes, 'id' | 'configId' | 'createdAt' | 'updatedAt' | 'deletedAt'>,
  security: Omit<ContainerSecurityAttributes, 'id' | 'configId' | 'createdAt' | 'updatedAt' | 'deletedAt'>
): Promise<ContainerConfig> => {
  try {
    // Create container configuration
    const containerConfig = await ContainerConfig.create({
      ...config,
      id: uuidv4(),
    });

    // Create container resources
    await ContainerResource.create({
      ...resources,
      id: uuidv4(),
      configId: containerConfig.id,
    });

    // Create container security options
    await ContainerSecurity.create({
      ...security,
      id: uuidv4(),
      configId: containerConfig.id,
    });

    return containerConfig;
  } catch (error: unknown) {
    console.error('Error creating container configuration:', error);
    throw error;
  }
};

/**
 * Get container configuration by ID
 * @param id Container configuration ID
 * @returns Promise<ContainerConfig | null>
 */
export const getContainerConfigById = async (id: string): Promise<ContainerConfig | null> => {
  try {
    return await ContainerConfig.findByPk(id, {
      include: [
        { model: ContainerResource, as: 'resources' },
        { model: ContainerSecurity, as: 'security' },
      ],
    });
  } catch (error: unknown) {
    console.error('Error getting container configuration:', error);
    throw error;
  }
};

/**
 * Get all container configurations
 * @returns Promise<ContainerConfig[]>
 */
export const getAllContainerConfigs = async (): Promise<ContainerConfig[]> => {
  try {
    return await ContainerConfig.findAll({
      include: [
        { model: ContainerResource, as: 'resources' },
        { model: ContainerSecurity, as: 'security' },
      ],
    });
  } catch (error: unknown) {
    console.error('Error getting all container configurations:', error);
    throw error;
  }
};

/**
 * Update container configuration
 * @param id Container configuration ID
 * @param config Container configuration
 * @param resources Container resources
 * @param security Container security options
 * @returns Promise<ContainerConfig | null>
 */
export const updateContainerConfig = async (
  id: string,
  config?: Partial<Omit<ContainerConfigAttributes, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>>,
  resources?: Partial<Omit<ContainerResourceAttributes, 'id' | 'configId' | 'createdAt' | 'updatedAt' | 'deletedAt'>>,
  security?: Partial<Omit<ContainerSecurityAttributes, 'id' | 'configId' | 'createdAt' | 'updatedAt' | 'deletedAt'>>
): Promise<ContainerConfig | null> => {
  try {
    // Update container configuration
    const containerConfig = await ContainerConfig.findByPk(id);
    if (!containerConfig) {
      return null;
    }

    if (config) {
      await containerConfig.update(config);
    }

    // Update container resources
    if (resources) {
      const containerResources = await ContainerResource.findOne({
        where: { configId: id },
      });
      if (containerResources) {
        await containerResources.update(resources);
      }
    }

    // Update container security options
    if (security) {
      const containerSecurity = await ContainerSecurity.findOne({
        where: { configId: id },
      });
      if (containerSecurity) {
        await containerSecurity.update(security);
      }
    }

    // Return updated container configuration
    return await getContainerConfigById(id);
  } catch (error: unknown) {
    console.error('Error updating container configuration:', error);
    throw error;
  }
};

/**
 * Delete container configuration
 * @param id Container configuration ID
 * @returns Promise<boolean>
 */
export const deleteContainerConfig = async (id: string): Promise<boolean> => {
  try {
    const containerConfig = await ContainerConfig.findByPk(id);
    if (!containerConfig) {
      return false;
    }

    // Delete container resources
    await ContainerResource.destroy({
      where: { configId: id },
    });

    // Delete container security options
    await ContainerSecurity.destroy({
      where: { configId: id },
    });

    // Delete container configuration
    await containerConfig.destroy();

    return true;
  } catch (error: unknown) {
    console.error('Error deleting container configuration:', error);
    throw error;
  }
};

/**
 * Create a container
 * @param container Container
 * @returns Promise<Container>
 */
export const createContainer = async (
  container: Omit<ContainerAttributes, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>
): Promise<Container> => {
  try {
    return await Container.create({
      ...container,
      id: uuidv4(),
    });
  } catch (error: unknown) {
    console.error('Error creating container:', error);
    throw error;
  }
};

/**
 * Get container by ID
 * @param id Container ID
 * @returns Promise<Container | null>
 */
export const getContainerById = async (id: string): Promise<Container | null> => {
  try {
    return await Container.findByPk(id, {
      include: [
        {
          model: ContainerConfig,
          as: 'config',
          include: [
            { model: ContainerResource, as: 'resources' },
            { model: ContainerSecurity, as: 'security' },
          ],
        },
      ],
    });
  } catch (error: unknown) {
    console.error('Error getting container:', error);
    throw error;
  }
};

/**
 * Get all containers
 * @returns Promise<Container[]>
 */
export const getAllContainers = async (): Promise<Container[]> => {
  try {
    return await Container.findAll({
      include: [
        {
          model: ContainerConfig,
          as: 'config',
          include: [
            { model: ContainerResource, as: 'resources' },
            { model: ContainerSecurity, as: 'security' },
          ],
        },
      ],
    });
  } catch (error: unknown) {
    console.error('Error getting all containers:', error);
    throw error;
  }
};

/**
 * Update container
 * @param id Container ID
 * @param container Container
 * @returns Promise<Container | null>
 */
export const updateContainer = async (
  id: string,
  container: Partial<Omit<ContainerAttributes, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>>
): Promise<Container | null> => {
  try {
    const containerInstance = await Container.findByPk(id);
    if (!containerInstance) {
      return null;
    }

    await containerInstance.update(container);
    return containerInstance;
  } catch (error: unknown) {
    console.error('Error updating container:', error);
    throw error;
  }
};

/**
 * Delete container
 * @param id Container ID
 * @returns Promise<boolean>
 */
export const deleteContainer = async (id: string): Promise<boolean> => {
  try {
    const container = await Container.findByPk(id);
    if (!container) {
      return false;
    }

    await container.destroy();
    return true;
  } catch (error: unknown) {
    console.error('Error deleting container:', error);
    throw error;
  }
};
