export const formatRelativeAge = (isoDate: string): string => {
  const now = Date.now();
  const deltaMs = Math.max(0, now - Date.parse(isoDate));
  const minutes = Math.floor(deltaMs / 60_000);

  if (minutes < 1) {
    return "just now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};
