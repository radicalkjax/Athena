import { ModelType } from '../model/model';
export declare type ModelClassGetter<TCreationAttributes extends {}, TModelAttributes extends {}> = (returns?: void) => ModelType<TCreationAttributes, TModelAttributes>;
