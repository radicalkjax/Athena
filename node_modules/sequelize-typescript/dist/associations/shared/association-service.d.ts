import 'reflect-metadata';
import { BelongsToOptions, HasOneOptions, HasManyOptions, ManyToManyOptions } from 'sequelize';
import { BaseAssociation } from './base-association';
export declare type NonBelongsToManyAssociationOptions = BelongsToOptions | HasManyOptions | HasOneOptions | ManyToManyOptions;
export declare function getPreparedAssociationOptions(optionsOrForeignKey?: string | NonBelongsToManyAssociationOptions): NonBelongsToManyAssociationOptions;
/**
 * Stores association meta data for specified class
 */
export declare function addAssociation<TCreationAttributes extends {}, TModelAttributes extends {}>(target: any, association: BaseAssociation<TCreationAttributes, TModelAttributes>): void;
/**
 * Returns association meta data from specified class
 */
export declare function getAssociations<TCreationAttributes extends {}, TModelAttributes extends {}>(target: any): BaseAssociation<TCreationAttributes, TModelAttributes>[] | undefined;
export declare function setAssociations<TCreationAttributes extends {}, TModelAttributes extends {}>(target: any, associations: BaseAssociation<TCreationAttributes, TModelAttributes>[]): void;
export declare function getAssociationsByRelation<TCreationAttributes extends {}, TModelAttributes extends {}>(target: any, relatedClass: any): BaseAssociation<TCreationAttributes, TModelAttributes>[];
