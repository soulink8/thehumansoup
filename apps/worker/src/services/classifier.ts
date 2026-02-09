/**
 * Content Classifier
 *
 * Extracts topics and content type from post metadata.
 * Phase 1: Simple keyword matching from titles/excerpts.
 * Phase 4 (future): Workers AI for semantic classification.
 */

/**
 * Extract likely topics from a post's title and excerpt.
 * Returns an array of lowercase topic slugs.
 */
export function classifyTopics(
  title: string,
  excerpt?: string | null,
): string[] {
  const text = `${title} ${excerpt ?? ""}`.toLowerCase();
  const matched: string[] = [];

  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (keywords.some((kw) => text.includes(kw))) {
      matched.push(topic);
    }
  }

  return matched.slice(0, 5); // Max 5 topics per piece of content
}

/**
 * Infer content type from post metadata.
 * Default is 'article' until the me3 protocol adds a type field.
 */
export function inferContentType(
  _title: string,
  _filePath?: string | null,
): string {
  // Future: inspect file extension, media URLs, etc.
  // For now, everything from me3 posts is an article
  return "article";
}

// ── Topic Keywords (Phase 1: Simple matching) ──────────────

const TOPIC_KEYWORDS: Record<string, string[]> = {
  ai: [
    "ai",
    "artificial intelligence",
    "machine learning",
    "llm",
    "gpt",
    "claude",
    "neural",
  ],
  startups: [
    "startup",
    "founder",
    "bootstrapped",
    "indie",
    "saas",
    "mvp",
    "launch",
  ],
  "web-dev": [
    "javascript",
    "typescript",
    "react",
    "vue",
    "nextjs",
    "node",
    "web dev",
    "frontend",
    "backend",
    "fullstack",
  ],
  design: ["design", "ui", "ux", "figma", "typography", "branding", "visual"],
  marketing: [
    "marketing",
    "seo",
    "growth",
    "content marketing",
    "copywriting",
    "conversion",
  ],
  crypto: [
    "crypto",
    "blockchain",
    "web3",
    "ethereum",
    "bitcoin",
    "defi",
    "nft",
  ],
  productivity: [
    "productivity",
    "workflow",
    "habits",
    "systems",
    "notion",
    "obsidian",
  ],
  writing: [
    "writing",
    "blogging",
    "newsletter",
    "essay",
    "storytelling",
    "prose",
  ],
  career: ["career", "job", "interview", "resume", "remote work", "freelance"],
  health: [
    "health",
    "fitness",
    "mental health",
    "wellness",
    "meditation",
    "exercise",
  ],
  finance: ["finance", "investing", "money", "budget", "financial", "stocks"],
  cloudflare: ["cloudflare", "workers", "d1", "r2", "pages", "wrangler"],
  open_source: ["open source", "open-source", "oss", "github", "contribution"],
  community: [
    "community",
    "meetup",
    "conference",
    "networking",
    "collaboration",
  ],
};
