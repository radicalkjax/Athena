declare module 'react-icons/ai' {
  import { ComponentType } from 'react';

  interface IconProps {
    size?: number | string;
    color?: string;
    title?: string;
    className?: string;
    style?: React.CSSProperties;
  }

  export const AiFillRobot: ComponentType<IconProps>;
  export const AiFillAliwangwang: ComponentType<IconProps>;
  export const AiOutlineCodepenCircle: ComponentType<IconProps>;
  export const AiFillOpenAI: ComponentType<IconProps>;
  export const AiFillMeh: ComponentType<IconProps>;
  export const AiOutlineQq: ComponentType<IconProps>;
  export const AiOutlineWeibo: ComponentType<IconProps>;
  export const AiOutlineSync: ComponentType<IconProps>;
}
