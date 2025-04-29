import { ForeignKeyOptions } from 'sequelize';
import { ForeignKeyMeta } from './foreign-key-meta';
import { ModelClassGetter } from '../../model/shared/model-class-getter';
import { ModelType } from '../../model/model/model';
export declare function getForeignKeyOptions<TCreationAttributes extends {}, TModelAttributes extends {}, TCreationAttributesThrough extends {}, TModelAttributesThrough extends {}>(relatedClass: ModelType<TCreationAttributes, TModelAttributes>, classWithForeignKey?: ModelType<TCreationAttributesThrough, TModelAttributesThrough>, foreignKey?: string | ForeignKeyOptions): ForeignKeyOptions;
/**
 * Adds foreign key meta data for specified class
 */
export declare function addForeignKey<TCreationAttributes extends {}, TModelAttributes extends {}>(target: any, relatedClassGetter: ModelClassGetter<TCreationAttributes, TModelAttributes>, foreignKey: string): void;
/**
 * Returns foreign key meta data from specified class
 */
export declare function getForeignKeys<TCreationAttributes extends {}, TModelAttributes extends {}>(target: any): ForeignKeyMeta<TCreationAttributes, TModelAttributes>[] | undefined;
