<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import Typed from "typed.js";
import ContentCard from "../components/ContentCard.vue";

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
const typedSpiceTarget = ref<HTMLElement | null>(null);
let typedInstance: Typed | null = null;
let typedSpiceInstance: Typed | null = null;

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
        "/discover/content?limit=6&offset=0",
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
    const response = await fetchJson<{
      creator: CreatorProfile;
      content: ContentItem[];
    }>(`/profile/by-url?url=${encoded}`);
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

  const target = typedTarget.value;
  if (target) {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
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

  const spiceTarget = typedSpiceTarget.value;
  if (spiceTarget) {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (prefersReducedMotion) {
      spiceTarget.textContent = "spice";
    } else {
      spiceTarget.textContent = "";
      typedSpiceInstance = new Typed(spiceTarget, {
        strings: ["spice", "sauce"],
        typeSpeed: 56,
        backSpeed: 32,
        backDelay: 1400,
        startDelay: 400,
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
  typedSpiceInstance?.destroy();
});
</script>

<template>
  <div class="page">
    <!-- <div class="beta-banner">
      <span class="beta-pill">Beta</span>
      <span>Open index for Blog 3.0.</span>
    </div> -->

    <section class="hero hero-centered">
      <h1 class="hero-title">
        The place agents swim for <br />
        <span class="typed-text" ref="typedTarget">content.</span>
      </h1>
      <h1 class="hero-sub">
        <span style="text-decoration: line-through">AI agents</span> Waiters
        serve soup
        <span style="text-decoration: line-through">human content</span>
        <br />
        just how you like it.
      </h1>
      <div class="hero-actions">
        <!-- <form class="lookup hero-lookup" @submit.prevent="lookupSite">
          <input
            v-model="lookupUrl"
            type="url"
            placeholder="https://you.me3.app"
            aria-label="me3 site URL"
          />
          <button
            class="button primary"
            type="submit"
            :disabled="lookupLoading"
          >
            {{ lookupLoading ? "Checking" : "Check your site" }}
          </button>
        </form> -->
        <div class="hero-cta-row">
          <RouterLink class="button primary" to="/kitchen/make">
            Make my soup
          </RouterLink>
        </div>
      </div>
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
        <ContentCard
          v-for="item in lookupContent"
          :key="item.id"
          :item="item"
        />
      </div>
    </section>

    <section id="soup" class="section">
      <div class="soup-cauldron">
        <div class="soup-bubbles" aria-hidden="true">
          <span class="soup-bubble" style="--x: 12%; --y: 72%; --d: 8s"
            >me.json</span
          >
          <span class="soup-bubble" style="--x: 28%; --y: 40%; --d: 6.5s"
            >me.json</span
          >
          <span class="soup-bubble" style="--x: 48%; --y: 65%; --d: 7.2s"
            >me.json</span
          >
          <span class="soup-bubble" style="--x: 64%; --y: 35%; --d: 5.8s"
            >me.json</span
          >
          <span class="soup-bubble" style="--x: 78%; --y: 70%; --d: 7.6s"
            >me.json</span
          >
          <span class="soup-bubble" style="--x: 88%; --y: 48%; --d: 6.9s"
            >me.json</span
          >
        </div>
        <div class="stats-grid">
          <div class="stat-card">
            <p class="stat-label">Humans</p>
            <p class="stat-value">
              {{ stats ? formatNumber(stats.creators) : "—" }}
            </p>
          </div>
          <div class="stat-card">
            <p class="stat-label">Posts</p>
            <p class="stat-value">
              {{ stats ? formatNumber(stats.content) : "—" }}
            </p>
          </div>
          <!-- <div class="stat-card">
            <p class="stat-label">Subscriptions</p>
            <p class="stat-value">
              {{ stats ? formatNumber(stats.subscriptions) : "—" }}
            </p>
          </div> -->
          <div class="stat-card">
            <p class="stat-label">Last update</p>
            <p class="stat-value">{{ lastCrawlLabel }}</p>
          </div>
        </div>
      </div>

      <!-- <div class="panel">
        <div class="panel-header">
          <h3>Fresh additions</h3>
          <span v-if="loading" class="panel-badge">Loading</span>
          <span v-else class="panel-badge">{{ latest.length }} items</span>
        </div>
        <p v-if="error" class="error">{{ error }}</p>
        <div class="content-grid">
          <ContentCard v-for="item in latest" :key="item.id" :item="item" />
        </div>
      </div> -->
    </section>

    <section class="hero login-hero">
      <p class="eyebrow">Attention Creators</p>
      <h1 class="hero-title">
        Add your <span class="typed-text" ref="typedSpiceTarget">spice</span>
        <br />to THE SOUP
      </h1>
      <RouterLink class="button primary" to="/login"> Sign in </RouterLink>
    </section>

    <!-- <section id="blog3" class="section split">
      <div>
        <p class="eyebrow">Blog Wars</p>
        <h2>Blog Wars: The return of the blogger.</h2>
        <p>
          Blogging started on personal sites. Platforms took it over. Blog 3.0
          brings it back to you, with a <code>me.json</code> that AIs can read.
        </p>
        <p class="muted">
          Blog 3.0 = your personal media node on the open web.
        </p>
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
    </section> -->

    <footer class="footer">
      <div>
        <p class="muted">The Human Soup 2026</p>
      </div>
      <!-- <div class="footer-links">
        <span>Powered by me3</span>
      </div> -->
    </footer>
  </div>
</template>
