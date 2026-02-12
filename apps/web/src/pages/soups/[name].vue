<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import ContentCard from "../../components/ContentCard.vue";

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
  addedBy?: string;
  addedVia?: string;
};

type MySoupResponse = {
  name: string;
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

const soupName = computed(() => String(route.params.name || "").trim().replace(/^@+/, "").toLowerCase());

const filteredLabel = computed(() =>
  activeType.value === "all" ? "All formats" : activeType.value,
);

const sourceLabels = computed(() =>
  sources.value.map((source) => ({
    label: source.name || domainFromUrl(source.feedUrl),
    addedBy:
      source.addedBy === "agent"
        ? "agent"
        : source.addedBy
          ? "human"
          : undefined,
  })),
);

async function fetchSoup() {
  if (!soupName.value) return;
  loading.value = true;
  error.value = null;

  const typeParam =
    activeType.value === "all" ? "" : `&type=${activeType.value}`;
  const url = `/my-soup/${encodeURIComponent(soupName.value)}?limit=50${typeParam}`;

  try {
    const response = await fetch(`${API_BASE}${url}`);
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    const data = (await response.json()) as MySoupResponse;
    items.value = data.items ?? [];
    sources.value = data.sources ?? [];
    displayName.value = data.displayName || data.name;
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
  () => [soupName.value, activeType.value],
  () => {
    fetchSoup();
  },
);
</script>

<template>
  <div class="page">
    <div class="beta-banner">
      <span class="beta-pill">Soup</span>
      <span
        >Custom feed for <strong>{{ soupName }}</strong
        >.</span
      >
    </div>

    <section class="hero soup-hero">
      <p class="eyebrow">Personal Digest</p>
      <h1 class="hero-title">{{ displayName || soupName }}'s Soup</h1>
      <p class="hero-sub">
        A living stream of what your favorite creators just published. Filter by
        format or ask your agent to serve it.
      </p>
      <div class="soup-actions">
        <button
          class="button primary"
          type="button"
          @click="fetchSoup"
          :disabled="loading"
        >
          {{ loading ? "Simmering..." : "Serve me my soup" }}
        </button>
        <span class="muted"
          >Showing {{ total }} items · {{ filteredLabel }}</span
        >
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
        <span
          v-for="(source, index) in sourceLabels"
          :key="`${source.label}-${index}`"
          class="source-pill"
        >
          <span>{{ source.label }}</span>
          <span v-if="source.addedBy" class="source-meta"
            >added by: {{ source.addedBy }}</span
          >
        </span>
      </div>

      <p v-if="error" class="error">{{ error }}</p>
      <p v-else-if="!items.length && !loading" class="muted">
        No items yet. Try refreshing sources.
      </p>

      <div class="content-grid">
        <ContentCard v-for="item in items" :key="item.id" :item="item" />
      </div>
    </section>
  </div>
</template>
