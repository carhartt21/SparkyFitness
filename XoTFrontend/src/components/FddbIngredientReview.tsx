import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useDatabaseFoodSearchQuery } from '@/hooks/Foods/useFoods';
import type { Food } from '@/types/food';
import {
  fddbIngredientSearchTerm,
  type FddbIngredient,
} from '@/utils/fddbIngredients';

interface IngredientRowProps {
  ingredient: FddbIngredient;
  onChoose: (food: Food) => void;
  onSearch: () => void;
}

const IngredientRow = ({
  ingredient,
  onChoose,
  onSearch,
}: IngredientRowProps) => {
  const { t } = useTranslation();
  const search = useDatabaseFoodSearchQuery(
    fddbIngredientSearchTerm(ingredient.name),
    5
  );
  const foods = search.data?.pages.flatMap((page) => page.foods) || [];
  return (
    <li className="space-y-2 py-4 first:pt-0 last:pb-0">
      <p className="font-medium break-words">{ingredient.label}</p>
      {ingredient.quantity === undefined && (
        <p className="text-sm text-muted-foreground">
          {t(
            'fddbReview.checkAmount',
            'Choose the quantity and unit when linking this ingredient.'
          )}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {search.isPending ? (
          <p className="text-sm text-muted-foreground" role="status">
            {t('fddbReview.searching', 'Checking your food library…')}
          </p>
        ) : search.isError ? (
          <>
            <p className="text-sm text-destructive" role="alert">
              {t(
                'fddbReview.searchError',
                'Could not check your food library.'
              )}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => void search.refetch()}
            >
              {t('common.retry', 'Retry')}
            </Button>
          </>
        ) : foods.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('fddbReview.noMatch', 'No match in your food library.')}
          </p>
        ) : (
          foods.map((food) => (
            <Button
              key={food.id}
              type="button"
              variant="outline"
              className="h-auto min-h-11 whitespace-normal text-left"
              onClick={() => onChoose(food)}
            >
              {t('fddbReview.useFood', {
                defaultValue: 'Use {{name}}',
                name: [food.name, food.brand].filter(Boolean).join(', '),
              })}
            </Button>
          ))
        )}
        <Button
          type="button"
          variant="secondary"
          className="h-auto min-h-11 whitespace-normal text-left"
          onClick={onSearch}
        >
          {t('fddbReview.searchFoods', 'Search foods and providers')}
        </Button>
      </div>
    </li>
  );
};

interface FddbIngredientReviewProps {
  ingredients: FddbIngredient[];
  onChoose: (index: number, food: Food) => void;
  onSearch: (index: number) => void;
}

export const FddbIngredientReview = ({
  ingredients,
  onChoose,
  onSearch,
}: FddbIngredientReviewProps) => {
  const { t } = useTranslation();
  if (!ingredients.length) return null;
  return (
    <section
      className="space-y-4"
      aria-labelledby="fddb-ingredient-review-title"
    >
      <div className="space-y-2">
        <h3 id="fddb-ingredient-review-title" className="text-lg font-semibold">
          {t('fddbReview.title', 'Link imported ingredients')}
        </h3>
        <p className="text-sm text-muted-foreground max-w-prose">
          {t(
            'fddbReview.description',
            'Choose a food from your library first, or search your configured providers. Confirm each amount, then save the meal to calculate its nutrition.'
          )}
        </p>
      </div>
      <ul className="divide-y divide-border">
        {ingredients.map((ingredient, index) => (
          <IngredientRow
            key={`${index}-${ingredient.label}`}
            ingredient={ingredient}
            onChoose={(food) => onChoose(index, food)}
            onSearch={() => onSearch(index)}
          />
        ))}
      </ul>
    </section>
  );
};
