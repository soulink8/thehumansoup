<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { fetchAuthSession } from "../../lib/auth";

const API_BASE =
  import.meta.env.VITE_SOUP_API_URL ??
  "https://thehumansoup-worker.kieranbutler.workers.dev";

const router = useRouter();
const loading = ref(true);
const error = ref<string | null>(null);
const soups = ref<
  Array<{
    id: string;
    name: string;
    displayName: string;
    visibility: "public" | "unlisted" | "private";
    me3SiteUrl: string | null;
    createdAt: string;
  }>
>([]);

async function loadSoups() {
  loading.value = true;
  error.value = null;

  try {
    const session = await fetchAuthSession(API_BASE);
    if (!session) {
      router.push("/login?redirect=/kitchen");
      return;
    }

    const response = await fetch(`${API_BASE}/kitchen/soups`, {
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`Failed to load soups: ${response.status}`);
    }

    const data = (await response.json()) as { soups?: typeof soups.value };
    soups.value = data.soups ?? [];
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to load soups";
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void loadSoups();
});
</script>

<template>
  <div class="page">
    <section class="hero">
      <p class="eyebrow">Kitchen</p>
      <h1 class="hero-title">Your soups</h1>
      <p class="hero-sub">
        Dashboard placeholder. Use it to create soups and add creator sources.
      </p>
      <div class="hero-actions">
        <RouterLink class="button primary" to="/kitchen/make"
          >Make a soup</RouterLink
        >
        <RouterLink class="button ghost" to="/kitchen/add"
          >Add creator sources</RouterLink
        >
      </div>
    </section>

    <section class="section">
      <p v-if="loading" class="muted">Loading...</p>
      <p v-else-if="error" class="error">{{ error }}</p>
      <p v-else-if="!soups.length" class="muted">
        No soups yet. Start with “Make a soup”.
      </p>
      <div v-else class="panel-list">
        <article v-for="soup in soups" :key="soup.id" class="panel">
          <h3>{{ soup.displayName || soup.name }}</h3>
          <p class="muted">/soups/{{ soup.name }} · {{ soup.visibility }}</p>
          <div class="hero-actions">
            <RouterLink class="button ghost" :to="`/soups/${soup.name}`"
              >Open soup</RouterLink
            >
            <RouterLink class="button ghost" :to="`/kitchen/add?name=${soup.name}`"
              >Edit sources</RouterLink
            >
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
.panel-list {
  display: grid;
  gap: 16px;
}
</style>
