/**
 * UI variant for player rendering.
 * We now keep only option A (initials avatar + matched rail).
 */

export type PlayerUiVariant = 'A'

const STORAGE_KEY = 'ui:playerCardVariant'
export const VARIANT_CHANGED_EVENT = 'ui:playerCardVariant:changed'

export const getPlayerUiVariant = (): PlayerUiVariant => {
  return 'A'
}

export const setPlayerUiVariant = (variant: PlayerUiVariant) => {
  window.dispatchEvent(new CustomEvent(VARIANT_CHANGED_EVENT, { detail: { variant: 'A' } }))
}


