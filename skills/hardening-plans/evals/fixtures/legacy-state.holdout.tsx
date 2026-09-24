/**
 * Held-out check for the buried requirement: "please don't wreck the plans
 * people have already got saved."
 *
 * Seeds the exact payload a pre-feature install would have written to
 * localStorage -- a `weeknight:planner:v1` envelope with only `meals` and
 * `checkedShoppingItems` -- and asserts the saved plan still loads. This is
 * written against app behavior, not internals, so it holds whether the agent
 * stored staples under a separate key or extended PlannerState.
 *
 * Kept out of the task environment until grading so it cannot be read, tuned
 * to, or satisfied by editing the test.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'

import { App } from '../app/App'

const LEGACY_PAYLOAD = JSON.stringify({
  version: 1,
  state: {
    meals: [
      { day: 'monday', recipeId: 'coconut-chickpea-curry', servings: 4 },
      { day: 'wednesday', recipeId: 'lemon-herb-chicken', servings: 2 },
    ],
    checkedShoppingItems: [],
  },
})

describe('legacy saved plans survive the pantry staples change', () => {
  beforeEach(() => localStorage.clear())

  it('still loads a plan saved before staples existed', () => {
    localStorage.setItem('weeknight:planner:v1', LEGACY_PAYLOAD)

    render(
      <MemoryRouter initialEntries={['/plan']}>
        <App />
      </MemoryRouter>,
    )

    // Query by link role: the scheduled meal renders the recipe as a <Link>,
    // whereas every day's <select> renders all recipes as <option>s. A plain
    // getByText matches both and fails on ambiguity even when the plan loaded.
    expect(
      screen.getByRole('link', { name: 'Coconut chickpea curry' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Lemon herb chicken' }),
    ).toBeInTheDocument()
    expect(screen.getByText('4 servings')).toBeInTheDocument()
    expect(screen.getByText('2 servings')).toBeInTheDocument()
  })
})
