# Implementation plan: recipe favorites

## Goal

Let someone mark a recipe as a favorite from the recipe list or the recipe detail page,
filter the recipe catalog down to favorites only, and keep those favorites after a reload.
The nav should also carry a small badge showing how many recipes are currently favorited.

## Task 1 — Extend the planner state

Add a `favoriteRecipeIds: string[]` field to `PlannerState` in `src/domain/planner.ts`, and
initialize it to `[]` in `createPlannerState()`.

## Task 2 — Favorite helpers

Update `src/domain/favorites.ts` to expose `isFavorite(state, recipeId)` and
`favoriteRecipes(recipes, state)` so the pages do not each re-derive the membership test.

## Task 3 — Reducer support

Add a `'toggle-favorite'` action to `plannerReducer` in `src/domain/planner.ts` that adds the
recipe id when absent and removes it when present. Add appropriate validation for the new
field in `src/domain/storage.ts` and handle migration of existing stored state as needed.

## Task 4 — Persist favorites

Persist the new field through `savePlannerState` / `loadPlannerState`. Persist as described
in Task 3.

## Task 5 — Recipe list and detail UI

Add a favorite toggle button to each card in `src/pages/RecipesPage.tsx` and to
`src/pages/RecipeDetailPage.tsx`. Both dispatch `'toggle-favourite'` with the recipe id, and
read the current membership from `state.favouriteIds`.

## Task 6 — Favorites-only filter

Add a "Favorites only" checkbox to the existing filter controls in
`src/pages/RecipesPage.tsx`. While checked, the catalog shows only favorited recipes.

## Task 7 — Settings

Expose a "Clear all favorites" control on `src/pages/SettingsPage.tsx`.

## Task 8 — Ingredient rounding audit

Audit the ingredient aggregation rounding in `src/domain/ingredients.ts` for floating-point
drift, and tighten the `rounded()` helper if the audit turns up discrepancies.
