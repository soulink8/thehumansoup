<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { fetchAuthSession, getAuthUser } from "../../lib/auth";

const API_BASE =
  import.meta.env.VITE_SOUP_API_URL ??
  "https://thehumansoup-worker.kieranbutler.workers.dev";

const router = useRouter();
const route = useRoute();

const handle = ref("");
const displayName = ref("");
const me3SiteUrl = ref("");
const sources = ref([
  {
    feedUrl: "",
    sourceType: "article" as "article" | "audio" | "video",
    name: "",
  },
]);

const error = ref<string | null>(null);
const isSaving = ref(false);

function addSource() {
  sources.value.push({ feedUrl: "", sourceType: "article", name: "" });
}

function removeSource(index: number) {
  sources.value.splice(index, 1);
}

async function submit() {
  error.value = null;
  const session = await fetchAuthSession(API_BASE);
  if (!session) {
    router.push("/login?redirect=/kitchen/add");
    return;
  }

  if (!me3SiteUrl.value.trim() && !handle.value.trim()) {
    error.value = "Add a me3 site URL or set a soup name first.";
    return;
  }

  isSaving.value = true;
  try {
    const response = await fetch(`${API_BASE}/kitchen/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        handle: handle.value.trim() || undefined,
        displayName: displayName.value.trim() || undefined,
        me3SiteUrl: me3SiteUrl.value.trim() || undefined,
        sources: sources.value
          .map((source) => ({
            feedUrl: source.feedUrl.trim(),
            sourceType: source.sourceType,
            name: source.name.trim() || undefined,
          }))
          .filter((source) => source.feedUrl),
      }),
    });

    if (response.status === 401) {
      router.push("/login?redirect=/kitchen/add");
      return;
    }

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to save soup");
    }

    const data = await response.json();
    const finalHandle = String(data.handle || "").replace(/^@/, "");
    await router.push(`/soups/${finalHandle}`);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to save soup";
  } finally {
    isSaving.value = false;
  }
}

onMounted(() => {
  void (async () => {
    const session = await fetchAuthSession(API_BASE);
    if (!session) {
      router.push("/login?redirect=/kitchen/add");
      return;
    }

    const user = session ?? getAuthUser();
    const queryName = String(route.query.name || "").trim();
    if (queryName && !handle.value) {
      handle.value = queryName.replace(/^@+/, "").toLowerCase();
    }
    if (user?.handle && !handle.value) {
      handle.value = user.handle;
    }
    if (user?.displayName && !displayName.value) {
      displayName.value = user.displayName;
    }
    if (user?.me3SiteUrl && !me3SiteUrl.value) {
      me3SiteUrl.value = user.me3SiteUrl;
    }
  })();
});
</script>

<template>
  <div class="page">
    <section class="hero">
      <p class="eyebrow">Kitchen</p>
      <h1 class="hero-title">Add creator sources</h1>
      <p class="hero-sub">
        Link your me3 site and add RSS sources to update one of your soups.
      </p>
    </section>

    <section class="wizard-card">
      <div class="kitchen-grid">
        <div class="kitchen-panel">
          <h2>ME3</h2>
          <p class="muted">
            Blog 3.0: publish once and your site becomes the source of truth.
          </p>
          <label class="field">
            me3 site URL
            <input
              v-model="me3SiteUrl"
              type="url"
              placeholder="https://yourname.me3.app"
            />
          </label>
          <label class="field">
            Soup name
            <input v-model="handle" type="text" placeholder="my-soup" />
          </label>
          <label class="field">
            Display name (optional)
            <input v-model="displayName" type="text" placeholder="Your name" />
          </label>
        </div>

        <div class="kitchen-panel">
          <h2>Other platforms</h2>
          <p class="muted">
            Add RSS feeds for YouTube, Substack, podcasts, or any blog.
          </p>

          <div class="source-list">
            <div
              v-for="(source, index) in sources"
              :key="`source-${index}`"
              class="source-row"
            >
              <input
                v-model="source.feedUrl"
                type="url"
                placeholder="https://yourfeed.com/rss.xml"
              />
              <select v-model="source.sourceType">
                <option value="article">Article</option>
                <option value="video">Video</option>
                <option value="audio">Audio</option>
              </select>
              <button
                class="icon-button"
                type="button"
                @click="removeSource(index)"
                :disabled="sources.length === 1"
              >
                Remove
              </button>
            </div>
          </div>

          <button class="button ghost" type="button" @click="addSource">
            Add another feed
          </button>
        </div>
      </div>

      <div class="kitchen-actions">
        <button
          class="button primary"
          type="button"
          @click="submit"
          :disabled="isSaving"
        >
          {{ isSaving ? "Simmering..." : "Add to the soup" }}
        </button>
        <p v-if="error" class="error">{{ error }}</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.kitchen-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 20px;
}

.kitchen-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.source-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.source-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 120px 90px;
  gap: 10px;
  align-items: center;
}

.source-row input {
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid rgba(47, 42, 37, 0.2);
  font-size: 14px;
}

.source-row select {
  padding: 12px 10px;
  border-radius: 12px;
  border: 1px solid rgba(47, 42, 37, 0.2);
  font-size: 13px;
  background: rgba(255, 250, 241, 0.9);
}

.icon-button {
  border-radius: 999px;
  border: 1px solid rgba(47, 42, 37, 0.2);
  background: transparent;
  padding: 8px 12px;
  font-size: 12px;
  cursor: pointer;
}

.icon-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.kitchen-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 16px;
}
</style>
