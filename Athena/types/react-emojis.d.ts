declare module 'react-emojis' {
  import { ComponentType } from 'react';

  interface EmojiProps {
    emoji: string;
    size?: number;
  }

  const Emoji: ComponentType<EmojiProps>;
  export default Emoji;
}
