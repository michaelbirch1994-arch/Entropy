# UX Player Drill-down Pass

## Goal
Make the existing Top Players → Player Profiles workflow feel connected without changing any report data, metrics, or player identity rules.

## Root cause
Top Players already exposes stable account-level leaderboard entries and Player Profiles already supports selecting a profile locally, but there was no direct bridge between those two existing views. Users had to remember an account name, switch views, and find the same player again.

## Smallest compatible implementation
- Add an optional account-selection callback to the shared leaderboard table.
- When provided, render the player account as an actual button instead of making the whole row ambiguously clickable.
- From Top Players, use the existing `ViewContext.navigateToView()` contract to open Player Profiles with account and metric context.
- Let Player Profiles consume an incoming `player-profiles` navigation target and select the exact account when that profile exists.
- Keep ordinary sidebar navigation and standalone leaderboard rendering unchanged.

## Data paths
No analytics or report contracts change. The feature reuses:
- stable `LeaderboardEntry.account`
- existing Player Profile account identity
- existing cross-view navigation target and return trail

## Acceptance criteria
- Clicking a player account in the Top Players leaderboard opens Player Profiles on that exact account.
- The cross-view trail preserves the source metric/account and offers a return to Top Players.
- Missing/untracked profile accounts fail safely without inventing profile data.
- Keyboard activation works through a native button.
- Existing leaderboard values, sorting/order, metric calculations, and report data remain unchanged.
