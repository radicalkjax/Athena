// Mock models for testing
export const Container = {
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
  update: jest.fn(),
  destroy: jest.fn(),
};

export const ContainerConfig = {
  create: jest.fn(),
  findByPk: jest.fn(),
  update: jest.fn(),
};

export const ContainerMonitoring = {
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
};

export const ContainerResource = {
  create: jest.fn(),
  findByPk: jest.fn(),
  update: jest.fn(),
};

export const ContainerSecurity = {
  create: jest.fn(),
  findByPk: jest.fn(),
  update: jest.fn(),
};

export const ProcessActivity = {
  create: jest.fn(),
  findAll: jest.fn(),
  bulkCreate: jest.fn(),
};

export const NetworkActivity = {
  create: jest.fn(),
  findAll: jest.fn(),
  bulkCreate: jest.fn(),
};

export const FileActivity = {
  create: jest.fn(),
  findAll: jest.fn(),
  bulkCreate: jest.fn(),
};