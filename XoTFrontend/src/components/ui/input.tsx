import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { ChevronUp, ChevronDown } from 'lucide-react';

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    const { t } = useTranslation();
    const innerRef = React.useRef<HTMLInputElement>(null);

    React.useImperativeHandle(ref, () => innerRef.current!);

    const handleStep = (direction: 'up' | 'down') => {
      const input = innerRef.current;
      if (!input || input.disabled || input.readOnly) return;
      if (direction === 'up') {
        input.stepUp();
      } else {
        input.stepDown();
      }
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };

    const inputElement = (
      <input
        type={type === 'time' ? 'text' : type}
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          'dark:[color-scheme:dark]',
          type === 'number' && [
            '[appearance:textfield]',
            '[&::-webkit-outer-spin-button]:appearance-none',
            '[&::-webkit-inner-spin-button]:appearance-none',
            'pr-6',
          ],
          className
        )}
        ref={innerRef}
        {...props}
        {...(type === 'time'
          ? {
              inputMode: 'numeric' as const,
              placeholder: 'HH:mm',
              pattern: '(?:[01][0-9]|2[0-3]):[0-5][0-9]',
              maxLength: 5,
              title: t('common.time24HourHint', {
                defaultValue:
                  'Enter a time from 00:00 to 23:59 (for example, 14:30).',
              }),
              onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
                // Numeric mobile keyboards can enter 1430; the wire value remains
                // 14:30. Partial input is retained and fails native form validity.
                if (/^\d{4}$/.test(event.target.value)) {
                  event.target.value = `${event.target.value.slice(0, 2)}:${event.target.value.slice(2)}`;
                }
                props.onChange?.(event);
              },
            }
          : {})}
      />
    );

    if (type !== 'number') return inputElement;

    return (
      <div className="relative group/input w-full">
        {inputElement}
        <div className="absolute right-0 top-0 flex flex-col w-5 h-full border-l bg-muted/5 opacity-0 group-hover/input:opacity-100 transition-opacity z-10">
          <button
            type="button"
            tabIndex={-1}
            disabled={props.disabled || props.readOnly}
            className="flex flex-1 items-center justify-center hover:bg-accent hover:text-accent-foreground transition-colors border-b"
            onClick={() => handleStep('up')}
          >
            <ChevronUp className="h-2.5 w-2.5" />
          </button>
          <button
            type="button"
            tabIndex={-1}
            disabled={props.disabled || props.readOnly}
            className="flex flex-1 items-center justify-center hover:bg-accent hover:text-accent-foreground transition-colors"
            onClick={() => handleStep('down')}
          >
            <ChevronDown className="h-2.5 w-2.5" />
          </button>
        </div>
      </div>
    );
  }
);
Input.displayName = 'Input';

/** Autosaving clocks commit only a complete 24-hour value, on blur/Enter. */
function TimeCommitInput({
  value,
  onCommit,
  ...props
}: Omit<React.ComponentProps<'input'>, 'value' | 'type' | 'onChange'> & {
  value: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = React.useState(value);
  React.useEffect(() => setDraft(value), [value]);
  return (
    <Input
      {...props}
      type="time"
      value={draft}
      required
      onChange={(event) => setDraft(event.target.value)}
      onBlur={(event) => {
        props.onBlur?.(event);
        if (!event.currentTarget.reportValidity()) return;
        if (draft !== value) onCommit(draft);
      }}
      onKeyDown={(event) => {
        props.onKeyDown?.(event);
        if (event.key === 'Enter') {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
    />
  );
}
export { Input, TimeCommitInput };
