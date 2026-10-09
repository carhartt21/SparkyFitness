import {
  CommonActions,
  StackActions,
  type NavigationState,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type {
  FoodLoggingOrigin,
  RootStackParamList,
} from '../types/navigation';

function isOrigin(value: unknown): value is FoodLoggingOrigin {
  if (!value || typeof value !== 'object') return false;
  return (
    'routeKey' in value &&
    typeof value.routeKey === 'string' &&
    'date' in value &&
    typeof value.date === 'string'
  );
}

/** The search route also carries context for nested scan/photo flows. */
export function foodLoggingReturnAction(
  state: Pick<NavigationState, 'routes' | 'index'>,
  origin?: FoodLoggingOrigin,
  returnDepth?: number
) {
  if (returnDepth != null && returnDepth > 0)
    return StackActions.pop(returnDepth);
  const inherited = [...state.routes.slice(0, state.index + 1)]
    .reverse()
    .find(
      (route) =>
        ['FoodSearch', 'FoodScan', 'FoodPhotoIntro', 'FoodPhotoFlow'].includes(
          route.name
        ) &&
        route.params &&
        'loggingOrigin' in route.params &&
        isOrigin(route.params.loggingOrigin)
    )?.params;
  const context =
    origin ??
    (inherited &&
    'loggingOrigin' in inherited &&
    isOrigin(inherited.loggingOrigin)
      ? inherited.loggingOrigin
      : undefined);
  if (!context) return StackActions.popToTop();
  const index = state.routes.findIndex(
    (route) => route.key === context.routeKey
  );
  if (index >= 0 && index < state.index)
    return StackActions.pop(state.index - index);
  return CommonActions.navigate('DailyMeals', {
    date: context.date,
    mealTypeId: context.mealTypeId,
  });
}

export function returnAfterFoodLogging(
  navigation: NativeStackNavigationProp<RootStackParamList>,
  origin?: FoodLoggingOrigin,
  returnDepth?: number
) {
  navigation.dispatch(
    foodLoggingReturnAction(navigation.getState(), origin, returnDepth)
  );
}
