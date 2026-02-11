<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import Typed from "typed.js";

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
  media?: {
    url?: string;
    duration?: number;
    thumbnail?: string;
  };
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

type OwnerProfile = {
  handle: string;
  name: string;
  siteUrl: string;
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
const typedTarget = ref<HTMLElement | null>(null);
const owner = ref<OwnerProfile | null>(null);
let typedInstance: Typed | null = null;

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

const ownerSoupPath = computed(() =>
  owner.value ? `/@${owner.value.handle}` : "/@kieran"
);

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

async function loadOwner() {
  try {
    owner.value = await fetchJson<OwnerProfile>("/owner");
  } catch {
    owner.value = null;
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
  loadOwner();

  const target = typedTarget.value;
  if (target) {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) {
      target.textContent = "content.";
    } else {
      target.textContent = "";
      typedInstance = new Typed(target, {
        strings: ["content.", "podcasts.", "videos.", "articles."],
        typeSpeed: 56,
        backSpeed: 32,
        backDelay: 1400,
        startDelay: 200,
        loop: true,
        smartBackspace: true,
        showCursor: true,
        cursorChar: "▍",
      });
    }
  }
});

onBeforeUnmount(() => {
  typedInstance?.destroy();
});
</script>

<template>
  <div class="page">
    <div class="beta-banner">
      <span class="beta-pill">Beta</span>
      <span>Open index for Blog 3.0.</span>
    </div>

    <section class="hero hero-centered">
      <p class="eyebrow">The Human Soup</p>
      <h1 class="hero-title">
        The place agents swim for
        <span class="typed-text" ref="typedTarget">content.</span>
      </h1>
      <p class="hero-sub">
        You publish on your blog. It gets added to the soup. Agents act like chefs
        for their humans, serving the right content, when they want it, and how
        they want it.
      </p>
      <div class="hero-actions">
        <form class="lookup hero-lookup" @submit.prevent="lookupSite">
          <input
            v-model="lookupUrl"
            type="url"
            placeholder="https://you.me3.app"
            aria-label="me3 site URL"
          />
          <button class="button primary" type="submit" :disabled="lookupLoading">
            {{ lookupLoading ? "Checking" : "Check your site" }}
          </button>
        </form>
        <RouterLink class="button ghost" :to="ownerSoupPath">
          Serve me my soup
        </RouterLink>
      </div>
      <p class="hero-hint">Paste your me3 URL to see what the soup can read.</p>
      <p v-if="lookupError" class="error">{{ lookupError }}</p>

      <div v-if="lookupProfile" class="profile-card hero-result">
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

      <div v-if="lookupContent.length" class="content-grid hero-result-grid">
        <article v-for="item in lookupContent" :key="item.id" class="content-card">
          <div v-if="item.media?.thumbnail" class="content-thumb">
            <img :src="item.media.thumbnail" alt="" loading="lazy" />
          </div>
          <div class="content-meta">
            <span class="content-type">{{ item.contentType }}</span>
            <span class="content-date">{{ formatDate(item.publishedAt) }}</span>
          </div>
          <h4>{{ item.title }}</h4>
          <p>{{ item.excerpt || "New in the soup." }}</p>
          <div class="content-footer">
            <span class="content-author">{{ item.creatorName }}</span>
            <a
              v-if="item.contentUrl || item.media?.url"
              class="content-link"
              :href="item.media?.url || item.contentUrl"
              target="_blank"
              rel="noreferrer"
            >
              {{ item.contentType === "video" ? "Watch" : "Open" }}
            </a>
          </div>
        </article>
      </div>
    </section>

    <section id="soup" class="section">
      <div class="section-title">
        <h2>The Soup</h2>
        <p>Fresh signals from real people, on their own sites.</p>
      </div>

      <div class="soup-cauldron">
        <div class="soup-bubbles" aria-hidden="true">
          <span class="soup-bubble" style="--x: 12%; --y: 72%; --d: 8s;">me.json</span>
          <span class="soup-bubble" style="--x: 28%; --y: 40%; --d: 6.5s;">me.json</span>
          <span class="soup-bubble" style="--x: 48%; --y: 65%; --d: 7.2s;">me.json</span>
          <span class="soup-bubble" style="--x: 64%; --y: 35%; --d: 5.8s;">me.json</span>
          <span class="soup-bubble" style="--x: 78%; --y: 70%; --d: 7.6s;">me.json</span>
          <span class="soup-bubble" style="--x: 88%; --y: 48%; --d: 6.9s;">me.json</span>
        </div>
        <div class="stats-grid">
          <div class="stat-card">
            <p class="stat-label">Creators</p>
            <p class="stat-value">{{ stats ? formatNumber(stats.creators) : "—" }}</p>
            <p class="stat-note">Sites in the soup.</p>
          </div>
          <div class="stat-card">
            <p class="stat-label">Posts</p>
            <p class="stat-value">{{ stats ? formatNumber(stats.content) : "—" }}</p>
            <p class="stat-note">Across all formats.</p>
          </div>
          <div class="stat-card">
            <p class="stat-label">Subscriptions</p>
            <p class="stat-value">{{ stats ? formatNumber(stats.subscriptions) : "—" }}</p>
            <p class="stat-note">Who follows who.</p>
          </div>
          <div class="stat-card">
            <p class="stat-label">Last crawl</p>
            <p class="stat-value">{{ lastCrawlLabel }}</p>
            <p class="stat-note">Source: {{ apiLabel }}</p>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <h3>Fresh additions</h3>
          <span v-if="loading" class="panel-badge">Loading</span>
          <span v-else class="panel-badge">{{ latest.length }} items</span>
        </div>
        <p v-if="error" class="error">{{ error }}</p>
        <div class="content-grid">
          <article v-for="item in latest" :key="item.id" class="content-card">
            <div v-if="item.media?.thumbnail" class="content-thumb">
              <img :src="item.media.thumbnail" alt="" loading="lazy" />
            </div>
            <div class="content-meta">
              <span class="content-type">{{ item.contentType }}</span>
              <span class="content-date">{{ formatDate(item.publishedAt) }}</span>
            </div>
            <h4>{{ item.title }}</h4>
            <p>{{ item.excerpt || "New in the soup." }}</p>
            <div class="content-footer">
              <span class="content-author">{{ item.creatorName }}</span>
              <a
                v-if="item.contentUrl || item.media?.url"
                class="content-link"
                :href="item.media?.url || item.contentUrl"
                target="_blank"
                rel="noreferrer"
              >
                {{ item.contentType === "video" ? "Watch" : "Open" }}
              </a>
            </div>
          </article>
        </div>
      </div>
    </section>

    <section id="blog3" class="section split">
      <div>
        <p class="eyebrow">Blog Wars</p>
        <h2>Blog Wars: The return of the blogger.</h2>
        <p>
          Blogging started on personal sites. Platforms took it over. Blog 3.0
          brings it back to you, with a <code>me.json</code> that AIs can read.
        </p>
        <p class="muted">Blog 3.0 = your personal media node on the open web.</p>
      </div>
      <div class="card-list">
        <div class="stack-card">
          <p class="stat-label">Blog 1.0 (1999–2010)</p>
          <h4>The writing era</h4>
          <p>Your words on your site. Text-first. You owned it.</p>
        </div>
        <div class="stack-card">
          <p class="stat-label">Blog 2.0 (2010–2026)</p>
          <h4>The platform era</h4>
          <p>Video, audio, newsletters. Great reach, lost ownership.</p>
        </div>
        <div class="stack-card">
          <p class="stat-label">Blog 3.0 (Now)</p>
          <h4>The AI-readable era</h4>
          <p>Any format on your domain, structured for machines.</p>
        </div>
      </div>
    </section>

    <footer class="footer">
      <div>
        <p class="brand-title">The Human Soup</p>
        <p class="muted">The Human Soup is open source.</p>
      </div>
      <div class="footer-links">
        <span>Powered by me3</span>
        <span>Workers + D1</span>
        <span>Open-source</span>
      </div>
    </footer>
  </div>
</template>
