import type { KeyboardEvent } from 'react';

/**
 * Keyboard activation for non-button elements that act as buttons (role="button"):
 * Enter and Space trigger the action, matching native button behaviour.
 * Events coming from nested interactive children are ignored.
 */
export const onActivateKey = (action: () => void) => (e: KeyboardEvent<HTMLElement>) => {
  if (e.target !== e.currentTarget) return;
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    action();
  }
};
