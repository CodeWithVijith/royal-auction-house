export async function mutate(path: string, method: string, body?: unknown) {
  const response = await fetch('/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok) {
    const messages: Record<string, string> = {
      STALE_STATE:
        'Another tab changed the auction. Review the reloaded state.',
      STALE_SELECTION:
        'This selection is no longer pending. Review the saved state.',
      DECISION_PENDING: 'Finish the pending player decision before spinning.',
      INSUFFICIENT_BUDGET: 'This team cannot afford the final amount.',
      TEAM_FULL: 'This team has no roster slots remaining.',
      SETUP_REQUIRED:
        'Import players and create at least one team before starting.',
      AUCTION_PAUSED: 'Resume the auction before spinning.',
      TEAM_NAME_EXISTS: 'A team with this name already exists.',
      INVALID_CREDENTIALS: 'Email or password is incorrect.',
      ACCOUNT_UNAVAILABLE: 'This email cannot be registered. Try signing in.',
      TOO_MANY_ATTEMPTS: 'Too many attempts. Please try again in 15 minutes.',
      AUTH_REQUIRED: 'Your session has expired. Sign in again.',
      VALIDATION_FAILED: 'Check the form values and try again.',
      AUCTION_LOCKED: 'This auction has started and its settings are locked.',
      STALE_AUCTION:
        'This auction changed in another tab. Refresh before saving.',
      API_UNAVAILABLE: 'The service is unavailable. Please try again.',
    };
    throw new Error(
      messages[data.error] ??
        'The request could not be completed. Please try again.',
    );
  }
  return data;
}
