import { Model, ModelAttributes, DataTypes } from 'sequelize';
import sequelize from '../config/database';

// Base model attributes that all models will have
export const baseModelAttributes: ModelAttributes = {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  deletedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
};

// Base model class that all models will extend
export default abstract class BaseModel extends Model {
  public id!: string;
  public createdAt!: Date;
  public updatedAt!: Date;
  public deletedAt?: Date;
}
