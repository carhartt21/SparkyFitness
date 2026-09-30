import type React from 'react';

const TooltipWarning: React.FC<{
  warningMsg: string;
  color?: 'yellow' | 'blue';
}> = ({ warningMsg, color = 'yellow' }) => {
  const colorClass =
    color === 'blue'
      ? 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100'
      : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100';
  return (
    <div className={`rounded-md border p-3 text-sm ${colorClass}`} role="note">
      <strong>Note:</strong> {warningMsg}
    </div>
  );
};

export default TooltipWarning;
