import { ModelClassGetter } from '../../model/shared/model-class-getter';
export declare function ForeignKey<TCreationAttributes extends {}, TModelAttributes extends {}>(relatedClassGetter: ModelClassGetter<TCreationAttributes, TModelAttributes>): Function;
