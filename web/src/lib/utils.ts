export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function timeAgo(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000) - timestamp;
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
