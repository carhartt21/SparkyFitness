import React from 'react';
import { Image } from 'expo-image';
import { act, fireEvent, render } from '@testing-library/react-native';
import FoodThumbnail from '../../src/components/FoodThumbnail';
import { OFF_FOOD_GROUP_IMAGES } from '../../src/utils/offFoodGroupImages';

const getImageSource = (path: string) => ({
  uri: `https://server/api${path}`,
  headers: {},
});

describe('FoodThumbnail', () => {
  it('bundles a distinct asset slot for every substantive OFF food group', () => {
    expect(Object.keys(OFF_FOOD_GROUP_IMAGES)).toHaveLength(88);
  });
  it('renders the resolved image for a stored path', () => {
    const { UNSAFE_getByType } = render(
      <FoodThumbnail
        image="/uploads/foods/abc/1.jpg"
        foodIdentity={{
          provider_type: 'bls4',
          provider_external_id: 'G561100',
        }}
        getImageSource={getImageSource}
      />
    );

    expect(UNSAFE_getByType(Image).props.source).toEqual({
      uri: 'https://server/api/uploads/foods/abc/1.jpg',
      headers: {},
    });
  });

  it('uses stable BLS artwork across locales and updates recycled rows', () => {
    const onPress = jest.fn();
    const { rerender, UNSAFE_getByType, getByTestId } = render(
      <FoodThumbnail
        image={null}
        name="Tomato raw"
        foodIdentity={{
          provider_type: 'bls4',
          provider_external_id: 'G561100',
        }}
        getImageSource={getImageSource}
        onPress={onPress}
      />
    );
    expect(UNSAFE_getByType(Image).props.source).toEqual(
      require('../../assets/food-artwork/tomato-raw.png')
    );
    fireEvent.press(getByTestId('food-thumbnail'));
    expect(onPress).not.toHaveBeenCalled();
    rerender(
      <FoodThumbnail
        image={null}
        name="Reis poliert, gekocht"
        foodIdentity={{
          provider_type: 'bls4',
          provider_external_id: 'C352032',
        }}
        getImageSource={getImageSource}
      />
    );
    expect(UNSAFE_getByType(Image).props.source).toEqual(
      require('../../assets/food-artwork/rice-cooked.png')
    );
  });

  it('uses BLS artwork after photo retries fail and disables the photo action', () => {
    jest.useFakeTimers();
    const onPress = jest.fn();
    try {
      const { UNSAFE_getByType, UNSAFE_getAllByType, getByTestId } = render(
        <FoodThumbnail
          image="/uploads/missing.jpg"
          name="Tomato raw"
          foodIdentity={{
            provider_type: 'bls4',
            provider_external_id: 'G561100',
          }}
          getImageSource={getImageSource}
          onPress={onPress}
        />
      );
      const failPhoto = () => {
        const photo = UNSAFE_getAllByType(Image).find(
          (image) => image.props.source?.uri
        );
        expect(photo).toBeDefined();
        fireEvent(photo!, 'error');
      };
      failPhoto();
      act(() => jest.advanceTimersByTime(1500));
      failPhoto();
      act(() => jest.advanceTimersByTime(3000));
      failPhoto();
      expect(UNSAFE_getByType(Image).props.source).toEqual(
        require('../../assets/food-artwork/tomato-raw.png')
      );
      fireEvent.press(getByTestId('food-thumbnail'));
      expect(onPress).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('renders bundled group artwork when there is no image', () => {
    const { queryByTestId, UNSAFE_getByType } = render(
      <FoodThumbnail
        image={null}
        name="Tomate roh"
        getImageSource={getImageSource}
      />
    );

    expect(queryByTestId('food-thumbnail')).not.toBeNull();
    expect(UNSAFE_getByType(Image).props.source).toEqual(
      require('../../assets/food-fallbacks/vegetables.png')
    );
  });

  it('uses an OFF food group when the name alone is misleading', () => {
    const { UNSAFE_getByType } = render(
      <FoodThumbnail
        image={null}
        name="Chocolate Pasta"
        foodGroupTags={['en:cereals-and-potatoes', 'en:white-pasta']}
        getImageSource={getImageSource}
      />
    );
    expect(UNSAFE_getByType(Image).props.source).toEqual(
      require('../../assets/off-food-groups/white-pasta.png')
    );
  });

  it('renders nothing at all when fallbacks are suppressed', () => {
    // The diary row opts out: reserving a placeholder for every entry would
    // make a photo-free day taller than it was before images existed.
    const { queryByTestId } = render(
      <FoodThumbnail
        image={null}
        getImageSource={getImageSource}
        showFallback={false}
      />
    );

    expect(queryByTestId('food-thumbnail')).toBeNull();
  });

  it('still renders when an image is present and fallbacks are suppressed', () => {
    const { queryByTestId } = render(
      <FoodThumbnail
        image="/uploads/foods/abc/1.jpg"
        getImageSource={getImageSource}
        showFallback={false}
      />
    );

    expect(queryByTestId('food-thumbnail')).not.toBeNull();
  });
});

describe('FoodThumbnail interactivity', () => {
  it('is pressable when a handler is supplied', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <FoodThumbnail
        image="/uploads/foods/abc/1.jpg"
        getImageSource={getImageSource}
        onPress={onPress}
      />
    );

    fireEvent.press(getByTestId('food-thumbnail'));
    expect(onPress).toHaveBeenCalled();
  });

  it('stays inert when no handler is supplied', () => {
    // Rows without a viewer (e.g. the picker tiles) must not look tappable.
    const { getByTestId } = render(
      <FoodThumbnail
        image="/uploads/foods/abc/1.jpg"
        getImageSource={getImageSource}
      />
    );

    expect(
      getByTestId('food-thumbnail').props.accessibilityRole
    ).toBeUndefined();
  });
});
