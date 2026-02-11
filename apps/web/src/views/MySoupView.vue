<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";

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

type SourceItem = {
  feedUrl: string;
  type: string;
  name?: string;
  siteUrl?: string;
};

type MySoupResponse = {
  handle: string;
  displayName: string;
  items: ContentItem[];
  total: number;
  since: string | null;
  sources: SourceItem[];
};

const API_BASE =
  import.meta.env.VITE_SOUP_API_URL ??
  "https://thehumansoup-worker.kieranbutler.workers.dev";

const route = useRoute();
const loading = ref(false);
const error = ref<string | null>(null);
const items = ref<ContentItem[]>([]);
const sources = ref<SourceItem[]>([]);
const displayName = ref<string>("");
const total = ref<number>(0);
const activeType = ref<string>("all");

const handle = computed(() => String(route.params.handle || "").trim());

const filteredLabel = computed(() =>
  activeType.value === "all" ? "All formats" : activeType.value
);

const sourceLabels = computed(() =>
  sources.value.map((source) => source.name || domainFromUrl(source.feedUrl))
);

function formatDate(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatAction(type: string): string {
  if (type === "video") return "Watch";
  if (type === "audio") return "Listen";
  return "Open";
}

async function fetchSoup() {
  if (!handle.value) return;
  loading.value = true;
  error.value = null;

  const typeParam =
    activeType.value === "all" ? "" : `&type=${activeType.value}`;
  const url = `/my-soup/${encodeURIComponent(handle.value)}?limit=50${typeParam}`;

  try {
    const response = await fetch(`${API_BASE}${url}`);
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    const data = (await response.json()) as MySoupResponse;
    items.value = data.items ?? [];
    sources.value = data.sources ?? [];
    displayName.value = data.displayName || data.handle;
    total.value = data.total ?? data.items?.length ?? 0;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to load soup";
  } finally {
    loading.value = false;
  }
}

function setFilter(type: string) {
  activeType.value = type;
}

function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

onMounted(fetchSoup);

watch(
  () => [handle.value, activeType.value],
  () => {
    fetchSoup();
  }
);
</script>

<template>
  <div class="page">
    <div class="beta-banner">
      <span class="beta-pill">My Soup</span>
      <span>Custom feed for <strong>@{{ handle }}</strong>.</span>
    </div>

    <section class="hero soup-hero">
      <p class="eyebrow">Personal Digest</p>
      <h1 class="hero-title">{{ displayName || handle }}'s Soup</h1>
      <p class="hero-sub">
        A living stream of what your favorite creators just published.
        Filter by format or ask your agent to serve it.
      </p>
      <div class="soup-actions">
        <button class="button primary" type="button" @click="fetchSoup" :disabled="loading">
          {{ loading ? "Simmering..." : "Serve me my soup" }}
        </button>
        <span class="muted">Showing {{ total }} items · {{ filteredLabel }}</span>
      </div>
    </section>

    <section class="section">
      <div class="filter-row">
        <button
          class="filter-button"
          :class="{ active: activeType === 'all' }"
          @click="setFilter('all')"
        >
          All
        </button>
        <button
          class="filter-button"
          :class="{ active: activeType === 'video' }"
          @click="setFilter('video')"
        >
          Video
        </button>
        <button
          class="filter-button"
          :class="{ active: activeType === 'audio' }"
          @click="setFilter('audio')"
        >
          Audio
        </button>
        <button
          class="filter-button"
          :class="{ active: activeType === 'article' }"
          @click="setFilter('article')"
        >
          Articles
        </button>
      </div>

      <div v-if="sourceLabels.length" class="source-pills">
        <span v-for="(label, index) in sourceLabels" :key="`${label}-${index}`" class="source-pill">
          {{ label }}
        </span>
      </div>

      <p v-if="error" class="error">{{ error }}</p>
      <p v-else-if="!items.length && !loading" class="muted">No items yet. Try refreshing sources.</p>

      <div class="content-grid">
        <article v-for="item in items" :key="item.id" class="content-card">
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
              {{ formatAction(item.contentType) }}
            </a>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>
