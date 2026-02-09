<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

type Stats = {
  creators: number;
  content: number;
  subscriptions: number;
  topics: number;
  lastCrawl: string | null;
};

type ContentItem = {
  id: string;
  creatorId: string;
  creatorHandle: string;
  creatorName: string;
  slug: string;
  title: string;
  excerpt: string | null;
  contentType: string;
  contentUrl: string | null;
  publishedAt: string | null;
};

type CreatorProfile = {
  id: string;
  handle: string;
  name: string;
  bio?: string | null;
  location?: string | null;
  avatar?: string | null;
  siteUrl: string;
  postCount: number;
  contentTypes: string[];
  lastPublishedAt?: string | null;
};

const API_BASE =
  import.meta.env.VITE_SOUP_API_URL ??
  "https://thehumansoup-worker.kieranbutler.workers.dev";

const stats = ref<Stats | null>(null);
const latest = ref<ContentItem[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

const lookupUrl = ref("");
const lookupLoading = ref(false);
const lookupError = ref<string | null>(null);
const lookupProfile = ref<CreatorProfile | null>(null);
const lookupContent = ref<ContentItem[]>([]);

const lastCrawlLabel = computed(() => {
  if (!stats.value?.lastCrawl) return "Not yet";
  const date = new Date(stats.value.lastCrawl);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
});

const apiLabel = computed(() => {
  try {
    const url = new URL(API_BASE);
    return url.host;
  } catch {
    return API_BASE;
  }
});

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function formatDate(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

async function loadData() {
  loading.value = true;
  error.value = null;
  try {
    const [statsResponse, contentResponse] = await Promise.all([
      fetchJson<Stats>("/stats"),
      fetchJson<{ content: ContentItem[] }>(
        "/discover/content?limit=6&offset=0"
      ),
    ]);
    stats.value = statsResponse;
    latest.value = contentResponse.content ?? [];
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to load data";
  } finally {
    loading.value = false;
  }
}

async function lookupSite() {
  if (!lookupUrl.value.trim()) return;
  lookupLoading.value = true;
  lookupError.value = null;
  lookupProfile.value = null;
  lookupContent.value = [];

  try {
    const encoded = encodeURIComponent(lookupUrl.value.trim());
    const response = await fetchJson<{ creator: CreatorProfile; content: ContentItem[] }>(
      `/profile/by-url?url=${encoded}`
    );
    lookupProfile.value = response.creator;
    lookupContent.value = response.content ?? [];
  } catch (err) {
    lookupError.value =
      err instanceof Error ? err.message : "Could not find that site.";
  } finally {
    lookupLoading.value = false;
  }
}

onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="page">
    <header class="topbar">
      <div class="brand">
        <span class="brand-mark">HS</span>
        <div>
          <p class="brand-title">The Human Soup</p>
          <p class="brand-sub">AI-traversable creator index</p>
        </div>
      </div>
      <nav class="nav">
        <a href="#soup" class="nav-link">Live Soup</a>
        <a href="#blog3" class="nav-link">Blog 3.0</a>
        <a href="#lookup" class="nav-link">Look Up</a>
        <a href="#join" class="nav-link nav-cta">Add your site</a>
      </nav>
    </header>

    <section class="hero">
      <div class="hero-text">
        <p class="eyebrow">Blog 3.0</p>
        <h1>
          A personal media node your AI can understand.
        </h1>
        <p class="hero-sub">
          The Human Soup connects creator blogs into a living, open graph so
          personal AIs can discover, filter, and deliver the signal.
        </p>
        <div class="hero-actions">
          <a class="button primary" href="#soup">See what is in the soup</a>
          <a class="button ghost" href="#join">Register your site</a>
        </div>
        <div class="chips">
          <span class="chip">Own your domain</span>
          <span class="chip">Any format</span>
          <span class="chip">AI-readable</span>
          <span class="chip">Open by default</span>
        </div>
      </div>
      <div class="hero-visual">
        <div class="terrain">
          <div class="tile tile-a">
            <span>DATA</span>
          </div>
          <div class="tile tile-b">
            <span>PEOPLE</span>
          </div>
          <div class="tile tile-c">
            <span>PAI</span>
          </div>
          <div class="tile tile-d">
            <span>SOUP</span>
          </div>
          <div class="tile tile-e">
            <span>GRAPH</span>
          </div>
        </div>
        <div class="legend">
          <div>
            <strong>Nature x Computer</strong>
            <p>Signal grows when creators own their roots.</p>
          </div>
          <div class="legend-circuit"></div>
        </div>
      </div>
    </section>

    <section id="soup" class="section">
      <div class="section-title">
        <h2>Live Soup</h2>
        <p>Real-time pulses from the open web.</p>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <p class="stat-label">Creators</p>
          <p class="stat-value">{{ stats ? formatNumber(stats.creators) : "—" }}</p>
          <p class="stat-note">Connected sites in the index.</p>
        </div>
        <div class="stat-card">
          <p class="stat-label">Articles</p>
          <p class="stat-value">{{ stats ? formatNumber(stats.content) : "—" }}</p>
          <p class="stat-note">Posts indexed across formats.</p>
        </div>
        <div class="stat-card">
          <p class="stat-label">Subscriptions</p>
          <p class="stat-value">{{ stats ? formatNumber(stats.subscriptions) : "—" }}</p>
          <p class="stat-note">Intent signals in the graph.</p>
        </div>
        <div class="stat-card">
          <p class="stat-label">Last crawl</p>
          <p class="stat-value">{{ lastCrawlLabel }}</p>
          <p class="stat-note">Source: {{ apiLabel }}</p>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <h3>Latest content</h3>
          <span v-if="loading" class="panel-badge">Loading</span>
          <span v-else class="panel-badge">{{ latest.length }} items</span>
        </div>
        <p v-if="error" class="error">{{ error }}</p>
        <div class="content-grid">
          <article v-for="item in latest" :key="item.id" class="content-card">
            <div class="content-meta">
              <span class="content-type">{{ item.contentType }}</span>
              <span class="content-date">{{ formatDate(item.publishedAt) }}</span>
            </div>
            <h4>{{ item.title }}</h4>
            <p>{{ item.excerpt || "A fresh post in the soup." }}</p>
            <div class="content-footer">
              <span class="content-author">{{ item.creatorName }}</span>
              <a
                v-if="item.contentUrl"
                class="content-link"
                :href="item.contentUrl"
                target="_blank"
                rel="noreferrer"
              >
                Open
              </a>
            </div>
          </article>
        </div>
      </div>
    </section>

    <section id="blog3" class="section split">
      <div>
        <p class="eyebrow">Blog 3.0</p>
        <h2>Your personal media node on the open web.</h2>
        <p>
          Blog 3.0 returns publishing to the person, not the platform. It is
          multi-format, AI-readable, and owned by the creator.
        </p>
      </div>
      <div class="card-list">
        <div class="stack-card">
          <h4>One identity</h4>
          <p>Publish from your own domain with a machine-readable profile.</p>
        </div>
        <div class="stack-card">
          <h4>Any format</h4>
          <p>Text, video, audio, links, events, services. All in one feed.</p>
        </div>
        <div class="stack-card">
          <h4>AI-friendly</h4>
          <p>Structured metadata lets personal AIs curate without scraping.</p>
        </div>
      </div>
    </section>

    <section id="lookup" class="section">
      <div class="section-title">
        <h2>Look up a site</h2>
        <p>Test a me3 domain and see its indexed posts.</p>
      </div>
      <form class="lookup" @submit.prevent="lookupSite">
        <input
          v-model="lookupUrl"
          type="url"
          placeholder="https://kieran.me3.app"
          aria-label="me3 site URL"
        />
        <button class="button primary" type="submit" :disabled="lookupLoading">
          {{ lookupLoading ? "Searching" : "Find" }}
        </button>
      </form>
      <p v-if="lookupError" class="error">{{ lookupError }}</p>

      <div v-if="lookupProfile" class="profile-card">
        <div>
          <p class="eyebrow">Creator</p>
          <h3>{{ lookupProfile.name }}</h3>
          <p class="muted">{{ lookupProfile.siteUrl }}</p>
          <p>{{ lookupProfile.bio || "" }}</p>
        </div>
        <div class="profile-meta">
          <div>
            <p class="stat-label">Posts</p>
            <p class="stat-value">{{ lookupProfile.postCount }}</p>
          </div>
          <div>
            <p class="stat-label">Last published</p>
            <p class="stat-value">
              {{ formatDate(lookupProfile.lastPublishedAt) || "—" }}
            </p>
          </div>
        </div>
      </div>

      <div v-if="lookupContent.length" class="content-grid">
        <article v-for="item in lookupContent" :key="item.id" class="content-card">
          <div class="content-meta">
            <span class="content-type">{{ item.contentType }}</span>
            <span class="content-date">{{ formatDate(item.publishedAt) }}</span>
          </div>
          <h4>{{ item.title }}</h4>
          <p>{{ item.excerpt || "A fresh post in the soup." }}</p>
          <div class="content-footer">
            <span class="content-author">{{ item.creatorName }}</span>
            <a
              v-if="item.contentUrl"
              class="content-link"
              :href="item.contentUrl"
              target="_blank"
              rel="noreferrer"
            >
              Open
            </a>
          </div>
        </article>
      </div>
    </section>

    <section id="join" class="section callout">
      <div>
        <h2>Bring your site into the soup.</h2>
        <p>
          Publish from your domain, add a `me.json`, and ping the soup when you
          post. We will index the metadata so personal AIs can find your work.
        </p>
      </div>
      <div class="callout-actions">
        <a class="button primary" href="https://thehumansoup-worker.kieranbutler.workers.dev/health" target="_blank" rel="noreferrer">
          Check API health
        </a>
        <a class="button ghost" href="#lookup">Try a site lookup</a>
      </div>
    </section>

    <footer class="footer">
      <div>
        <p class="brand-title">The Human Soup</p>
        <p class="muted">Open index for human-first publishing.</p>
      </div>
      <div class="footer-links">
        <span>Powered by me3</span>
        <span>Workers + D1</span>
        <span>Open-source</span>
      </div>
    </footer>
  </div>
</template>
