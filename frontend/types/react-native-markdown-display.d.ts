declare module 'react-native-markdown-display' {
    import { ReactNode } from 'react';
    import { StyleProp, TextStyle, ViewStyle } from 'react-native';

    export interface MarkdownProps {
        children: ReactNode;
        style?: StyleProp<any>;
        rules?: Record<string, any>;
        onLinkPress?: (url: string) => boolean;
    }

    const Markdown: React.FC<MarkdownProps>;
    export default Markdown;
}
