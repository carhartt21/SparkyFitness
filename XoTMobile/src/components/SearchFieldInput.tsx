import { TextInput, type TextInputProps } from 'react-native';

/** Shared single-line search metrics keep the text and adjacent icons centered. */
export default function SearchFieldInput({ style, ...props }: TextInputProps) {
  return (
    <TextInput
      {...props}
      style={[
        {
          fontSize: 16,
          lineHeight: 20,
          minHeight: 44,
          padding: 0,
          includeFontPadding: false,
          textAlignVertical: 'center',
        },
        style,
      ]}
    />
  );
}
