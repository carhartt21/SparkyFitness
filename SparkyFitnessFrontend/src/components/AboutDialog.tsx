import type React from 'react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { X } from 'lucide-react';

interface AboutDialogProps {
  isOpen: boolean;
  onClose: () => void;
  version: string;
}

const AboutDialog: React.FC<AboutDialogProps> = ({
  isOpen,
  onClose,
  version,
}) => {
  const { t } = useTranslation();
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isOpen) {
      const handleMouseDown = (event: MouseEvent) => {
        if (
          contentRef.current &&
          !contentRef.current.contains(event.target as Node)
        ) {
          onClose();
        }
      };

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          onClose();
        }
      };

      document.addEventListener('mousedown', handleMouseDown);
      document.addEventListener('keydown', handleKeyDown);

      return () => {
        document.removeEventListener('mousedown', handleMouseDown);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, onClose]);

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent ref={contentRef}>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('aboutDialog.title', 'About X on Track')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-left">
                <img
                  src="/images/brand/x-on-track-light.png"
                  alt="X on Track logo"
                  className="h-12 w-12 object-contain dark:hidden"
                />
                <img
                  src="/images/brand/x-on-track-dark.png"
                  alt="X on Track logo"
                  className="hidden h-12 w-12 object-contain dark:block"
                />
                <div>
                  <strong className="block text-foreground">X on Track</strong>
                  <span>Keep getting better.</span>
                </div>
              </div>
              <p>
                {t(
                  'aboutDialog.personalBestDescription',
                  'X on Track helps you log what matters, understand your patterns, and improve relative to your own baseline. Keep getting better.'
                )}
              </p>
              <p>
                {t('aboutDialog.applicationVersion', 'Application Version: ')}
                <strong>{version}</strong>
              </p>
              <div>
                {t(
                  'aboutDialog.upstreamSourceAndLicense',
                  'Upstream source and license:'
                )}{' '}
                <a
                  href="https://github.com/CodeWithCJ/SparkyFitness"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  SparkyFitness{' '}
                  {t('aboutDialog.githubRepo', 'GitHub repository')}
                </a>
                .
              </div>
              <div>
                <h3 className="font-semibold mt-2">
                  {t('aboutDialog.technologiesUsed', 'Technologies Used:')}
                </h3>
                <h4 className="font-medium mt-2">
                  {t('aboutDialog.frontend', 'Frontend:')}
                </h4>
                <ul className="list-disc list-inside text-sm ml-4">
                  <li>React</li>
                  <li>TypeScript</li>
                  <li>Tailwind CSS</li>
                </ul>
                <h4 className="font-medium mt-2">
                  {t('aboutDialog.backend', 'Backend:')}
                </h4>
                <ul className="list-disc list-inside text-sm ml-4">
                  <li>Node.js</li>
                  <li>Express</li>
                  <li>PostgreSQL</li>
                </ul>
                <h4 className="font-medium mt-2">
                  {t('aboutDialog.externalApis', 'External APIs:')}
                </h4>
                <ul className="list-disc list-inside text-sm ml-4">
                  <li>
                    {t('aboutDialog.wgerApi', 'Wger API (Exercise Data)')}
                  </li>
                  <li>
                    {t('aboutDialog.foodDataApis', 'Food Data APIs:')}
                    <ul className="list-disc list-inside ml-4">
                      <li>
                        {t('aboutDialog.nutritionixApi', 'Nutritionix API')}
                      </li>
                      <li>{t('aboutDialog.fatsecretApi', 'FatSecret API')}</li>
                      <li>
                        {t(
                          'aboutDialog.openFoodFactsApi',
                          'Open Food Facts API'
                        )}
                      </li>
                      <li>
                        {t('aboutDialog.usdaApi', 'USDA Food Database API')}
                      </li>
                      <li>
                        {t(
                          'aboutDialog.swissFoodApi',
                          'Swiss Food Composition Database API'
                        )}
                      </li>
                      <li>
                        <a
                          href="https://www.blsdb.de/download"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {t(
                            'aboutDialog.bls4Credit',
                            'Bundeslebensmittelschlüssel 4.0 · Max Rubner-Institut (2025), CC BY 4.0'
                          )}
                        </a>
                      </li>
                    </ul>
                  </li>
                </ul>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:justify-center">
          <AlertDialogAction onClick={onClose}>
            {t('aboutDialog.gotIt', 'Got it')}
          </AlertDialogAction>
        </AlertDialogFooter>
        <AlertDialogCancel
          onClick={onClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground p-0"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">{t('aboutDialog.close', 'Close')}</span>
        </AlertDialogCancel>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default AboutDialog;
