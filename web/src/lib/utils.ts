export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function timeAgo(timestamp: number): string {
  // Auto-detect milliseconds vs seconds (ms timestamps are > 1e12)
  const ts = timestamp > 1e12 ? Math.floor(timestamp / 1000) : timestamp;
  const seconds = Math.floor(Date.now() / 1000) - ts;
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  return `${months}mo`;
}

export function extractTweetId(url: string): string | null {
  const match = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
  return match ? match[1] : null;
}

export function extractHandle(url: string): string | null {
  const match = url.match(/(?:twitter\.com|x\.com)\/(@?\w+)/);
  if (!match) return null;
  const handle = match[1].replace(/^@/, "");
  if (["status", "i", "search", "home", "explore", "notifications"].includes(handle)) return null;
  return handle;
}

export function extractSource(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "link";
  }
}

export function formatTimeRemaining(votingEndsAt: number): {
  text: string;
  color: string;
  urgent: boolean;
} {
  const now = Math.floor(Date.now() / 1000);
  const remaining = votingEndsAt - now;

  if (remaining <= 0) {
    return { text: "Ended", color: "#A8A29E", urgent: false };
  }

  const minutes = Math.ceil(remaining / 60);
  const hours = Math.floor(minutes / 60);

  let text: string;
  if (hours > 0) {
    text = `${hours}h ${minutes % 60}m left`;
  } else {
    text = `${minutes}m left`;
  }

  if (minutes < 5) {
    return { text, color: "#EF4444", urgent: true };
  }
  if (minutes < 15) {
    return { text, color: "#F59E0B", urgent: false };
  }
  return { text, color: "#A8A29E", urgent: false };
}
