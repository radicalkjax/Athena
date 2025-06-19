import { vi } from 'vitest';
import { Model as BaseModel, DataTypes as BaseDataTypes } from './sequelize.js';

// Re-export from sequelize mock
export { DataTypes } from './sequelize.js';
export { Sequelize } from './sequelize.js';

// Mock decorators
export const Table = () => (target) => target;
export const Column = () => (target, propertyName) => {};
export const Model = BaseModel;
export const PrimaryKey = () => (target, propertyName) => {};
export const AutoIncrement = () => (target, propertyName) => {};
export const AllowNull = (allowNull) => (target, propertyName) => {};
export const Default = (value) => (target, propertyName) => {};
export const Unique = () => (target, propertyName) => {};
export const ForeignKey = (relatedModel) => (target, propertyName) => {};
export const BelongsTo = (relatedModel) => (target, propertyName) => {};
export const HasMany = (relatedModel) => (target, propertyName) => {};
export const HasOne = (relatedModel) => (target, propertyName) => {};
export const BelongsToMany = (relatedModel, through) => (target, propertyName) => {};
export const CreatedAt = () => (target, propertyName) => {};
export const UpdatedAt = () => (target, propertyName) => {};
export const DeletedAt = () => (target, propertyName) => {};
export const BeforeCreate = () => (target, propertyName) => {};
export const BeforeUpdate = () => (target, propertyName) => {};
export const BeforeDestroy = () => (target, propertyName) => {};
export const AfterCreate = () => (target, propertyName) => {};
export const AfterUpdate = () => (target, propertyName) => {};
export const AfterDestroy = () => (target, propertyName) => {};
export const Scopes = (scopes) => (target) => target;
export const DefaultScope = (scope) => (target) => target;