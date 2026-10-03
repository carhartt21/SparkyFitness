import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import FoodListArtwork from '@/components/FoodSearch/FoodListArtwork';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));

describe('BLS library artwork', () => {
  it('preserves photos and makes a failed-photo illustration inert', () => {
    const onOpen = jest.fn();
    const { container, rerender } = render(
      <FoodListArtwork
        name="Tomato raw"
        src="/uploads/tomato.jpg"
        onOpen={onOpen}
        foodIdentity={{
          provider_type: 'bls4',
          provider_external_id: 'G561100',
        }}
      />
    );
    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      '/uploads/tomato.jpg'
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onOpen).toHaveBeenCalledTimes(1);
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      '/images/food-artwork/tomato-raw.webp'
    );
    expect(screen.queryByRole('button')).toBeNull();
    rerender(
      <FoodListArtwork
        name="Reis gekocht"
        src={null}
        foodIdentity={{
          provider_type: 'bls4',
          provider_external_id: 'C352032',
        }}
      />
    );
    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      '/images/food-artwork/rice-cooked.webp'
    );
  });
});
