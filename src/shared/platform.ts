export type Platform = "twitch" | "kick";

export function detectPlatform(url: string): Platform | null {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes("twitch.tv")) return "twitch";
  if (lowerUrl.includes("kick.com")) return "kick";
  return null;
}
