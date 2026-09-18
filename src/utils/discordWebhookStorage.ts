const DISCORD_WEBHOOK_STORAGE_KEY = "entropy.discordWebhookUrl";

export function loadDiscordWebhookUrl(): string {
  try {
    return localStorage.getItem(DISCORD_WEBHOOK_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveDiscordWebhookUrl(url: string): void {
  const trimmed = url.trim();
  try {
    if (trimmed) localStorage.setItem(DISCORD_WEBHOOK_STORAGE_KEY, trimmed);
    else localStorage.removeItem(DISCORD_WEBHOOK_STORAGE_KEY);
  } catch {
    // Keep the current session usable when persistent storage is unavailable.
  }
}

export function clearDiscordWebhookUrl(): void {
  try {
    localStorage.removeItem(DISCORD_WEBHOOK_STORAGE_KEY);
  } catch {
    // Clearing an unavailable store is already the desired state.
  }
}

export function isDiscordWebhookUrl(url: string): boolean {
  return /^https:\/\/(discord(?:app)?\.com)\/api\/webhooks\/\d+\/[\w.-]+(?:\?.*)?$/i.test(url.trim());
}
