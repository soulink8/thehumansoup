/**
 * Trust Score Calculation
 *
 * A layered trust gradient (0.0 to 1.0) based on observable signals.
 * No KYC, no surveillance -- just domain ownership, consistency, and community vouching.
 */

export interface TrustSignals {
  hasCustomDomain: boolean;
  historyMonths: number;
  postCount: number;
  subscriberCount: number;
  verified: boolean;
  vouchCount: number;
}

/**
 * Calculate a trust score from observable signals.
 * Returns a value between 0.0 and 1.0.
 */
export function calculateTrust(signals: TrustSignals): number {
  let score = 0;

  // Custom domain shows investment in identity
  if (signals.hasCustomDomain) score += 0.15;

  // Posting history shows consistency over time
  if (signals.historyMonths >= 1) score += 0.10;
  if (signals.historyMonths >= 6) score += 0.15;
  if (signals.historyMonths >= 12) score += 0.10;

  // Content volume shows genuine activity
  if (signals.postCount >= 3) score += 0.10;
  if (signals.postCount >= 10) score += 0.10;

  // Subscribers are a social signal of value
  if (signals.subscriberCount >= 5) score += 0.10;

  // Platform verification (domain verification via me3)
  if (signals.verified) score += 0.20;

  // Future: Human vouches via Soulink
  // Each vouch from a trusted human adds trust (capped)
  // score += Math.min(signals.vouchCount * 0.05, 0.20);

  return Math.min(score, 1.0);
}

/**
 * Get a human-readable trust level from a score.
 */
export function trustLevel(
  score: number
): "unknown" | "low" | "medium" | "high" | "verified" {
  if (score >= 0.8) return "verified";
  if (score >= 0.5) return "high";
  if (score >= 0.25) return "medium";
  if (score > 0) return "low";
  return "unknown";
}
