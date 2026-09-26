import type React from 'react';
import { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogOverlay, DialogPortal } from '@/components/ui/dialog';

interface AddCompItem {
  value: string;
  label: string;
  icon: LucideIcon;
  fullWidth?: boolean;
}

interface AddCompProps {
  isVisible: boolean;
  onClose: () => void;
  items: AddCompItem[];
  onNavigate: (value: string) => void;
  title?: string;
}

const AddComp: React.FC<AddCompProps> = ({
  isVisible,
  onClose,
  items,
  onNavigate,
  title,
}) => {
  const { t } = useTranslation();

  const handleItemClick = (value: string) => {
    onNavigate(value);
    onClose();
  };

  //full width support
  const regularItems = items.filter((item) => !item.fullWidth);
  const fullWidthItems = items.filter((item) => item.fullWidth);

  return (
    <Dialog open={isVisible} onOpenChange={(open) => !open && onClose()}>
      <DialogPortal>
        <DialogOverlay className="bg-black/40" />
        <DialogPrimitive.Content className="fixed bottom-0 left-1/2 z-50 w-full max-w-lg -translate-x-1/2 overflow-y-auto rounded-t-3xl border bg-background p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] shadow-2xl max-h-[75vh] sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:pb-6 focus:outline-none">
          <DialogPrimitive.Close
            className="absolute right-4 top-3 flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={t('common.close', 'Close')}
          >
            <span aria-hidden="true" className="text-2xl leading-none">
              &times;
            </span>
          </DialogPrimitive.Close>
          <DialogPrimitive.Title className="mb-4 mt-2 text-center text-2xl font-bold text-foreground">
            {title || t('addComp.addNew', 'Add New')}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            {t('addComp.chooseAction', 'Choose what you want to add.')}
          </DialogPrimitive.Description>

          {/* Regular grid items */}
          {regularItems.length > 0 && (
            <div className="grid grid-cols-2 gap-4 mt-4">
              {regularItems.map((item) => (
                <Button
                  key={item.value}
                  variant="outline"
                  className="flex flex-col items-center justify-center h-24 text-center bg-card text-card-foreground hover:bg-primary hover:text-primary-foreground transition-all duration-200"
                  onClick={() => handleItemClick(item.value)}
                >
                  <item.icon className="h-6 w-6 mb-1" />
                  <span className="text-sm font-semibold">{item.label}</span>
                </Button>
              ))}
            </div>
          )}

          {/* Full-width items */}
          {fullWidthItems.length > 0 && (
            <div className="flex flex-col gap-3 mt-4">
              {fullWidthItems.map((item) => (
                <Button
                  key={item.value}
                  variant="outline"
                  className="flex items-center justify-center h-16 w-full text-center bg-card text-card-foreground hover:bg-primary hover:text-primary-foreground transition-all duration-200"
                  onClick={() => handleItemClick(item.value)}
                >
                  <item.icon className="h-6 w-6 mr-2" />
                  <span className="text-base font-semibold">{item.label}</span>
                </Button>
              ))}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
};

export default AddComp;
