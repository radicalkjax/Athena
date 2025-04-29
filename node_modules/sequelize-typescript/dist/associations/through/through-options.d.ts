import { ThroughOptions as OriginThroughOptions } from 'sequelize';
import { ModelClassGetter } from '../../model/shared/model-class-getter';
export declare type ThroughOptions<TCreationAttributes extends {}, TModelAttributes extends {}> = {
    [K in keyof OriginThroughOptions]: K extends 'model' ? ModelClassGetter<TCreationAttributes, TModelAttributes> | string : OriginThroughOptions[K];
};
