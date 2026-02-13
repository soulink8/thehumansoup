<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import ContentCard from "../../components/ContentCard.vue";
import { fetchAuthSession } from "../../lib/auth";

type ThreadTurn = {
  role: "user" | "assistant";
  content: string;
};

type ServeRecommendation = {
  id: string;
  title: string;
  creatorName: string;
  creatorHandle: string;
  contentType: string;
  contentUrl: string;
  url: string;
  publishedAt: string | null;
  excerpt: string | null;
  media?: {
    url: string | null;
    thumbnail: string | null;
  };
  why: string;
  score: number;
  isFresh: boolean;
  keywords: string[];
};

type ServeResult = {
  soupName: string;
  prompt: string;
  days: number;
  refreshRequested: boolean;
  mode: {
    behavior: "listen" | "watch" | "read" | "mixed";
    intent: "latest" | "learn" | "entertainment" | "general";
    preferredTypes: string[];
  };
  summary: string;
  recommendations: ServeRecommendation[];
  coverage: {
    windowDays: number;
    totalMatches: number;
    recentMatches: number;
    thin: boolean;
  };
  needsRefresh: boolean;
  ingestion: {
    triggered: boolean;
    feedsIndexed?: number;
    itemsIndexed?: number;
  };
};

type UserTurn = {
  id: string;
  type: "user";
  prompt: string;
};

type AssistantTurn = {
  id: string;
  type: "assistant";
  prompt: string;
  loading: boolean;
  isSimmering: boolean;
  error: string | null;
  result: ServeResult | null;
  visibleCount: number;
};

type Turn = UserTurn | AssistantTurn;

type CardItem = {
  id: string;
  creatorName: string;
  title: string;
  contentType: string;
  contentUrl: string | null;
  publishedAt: string | null;
  media?: {
    url?: string;
    thumbnail?: string;
  };
};

const API_BASE =
  import.meta.env.VITE_SOUP_API_URL ??
  "https://thehumansoup-worker.kieranbutler.workers.dev";

const router = useRouter();
const prompt = ref("");
const loading = ref(false);
const pageError = ref<string | null>(null);
const turns = ref<Turn[]>([]);
const historyRef = ref<HTMLElement | null>(null);

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function resetThread() {
  turns.value = [];
  pageError.value = null;
}

function getThreadContext(): ThreadTurn[] {
  const context: ThreadTurn[] = [];
  for (const turn of turns.value) {
    if (turn.type === "user") {
      context.push({ role: "user", content: turn.prompt });
      continue;
    }
    if (turn.result?.summary) {
      context.push({ role: "assistant", content: turn.result.summary });
    }
  }
  return context.slice(-8);
}

async function submitPrompt() {
  const value = prompt.value.trim();
  if (!value || loading.value) return;

  const threadContext = getThreadContext();
  prompt.value = "";
  pageError.value = null;
  loading.value = true;

  const userTurn: UserTurn = {
    id: createId(),
    type: "user",
    prompt: value,
  };
  const assistantTurn: AssistantTurn = {
    id: createId(),
    type: "assistant",
    prompt: value,
    loading: true,
    isSimmering: false,
    error: null,
    result: null,
    visibleCount: 3,
  };
  turns.value.push(userTurn, assistantTurn);

  try {
    const initial = await requestSoup({
      prompt: value,
      refresh: false,
      thread: threadContext,
    });
    assistantTurn.loading = false;
    assistantTurn.result = initial;

    if (initial.needsRefresh) {
      assistantTurn.isSimmering = true;
      const refreshContext = [
        ...threadContext,
        { role: "user" as const, content: value },
        { role: "assistant" as const, content: initial.summary },
      ].slice(-8);
      const refreshed = await requestSoup({
        prompt: value,
        refresh: true,
        thread: refreshContext,
      });
      assistantTurn.result = refreshed;
      assistantTurn.isSimmering = false;
    }
  } catch (error) {
    assistantTurn.loading = false;
    assistantTurn.isSimmering = false;
    assistantTurn.error =
      error instanceof Error ? error.message : "Failed to serve soup";
  } finally {
    loading.value = false;
  }
}

async function requestSoup(payload: {
  prompt: string;
  refresh: boolean;
  thread: ThreadTurn[];
}): Promise<ServeResult> {
  const response = await fetch(`${API_BASE}/kitchen/serve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({
      prompt: payload.prompt,
      days: 7,
      limit: 12,
      refresh: payload.refresh,
      thread: payload.thread,
    }),
  });

  if (response.status === 401) {
    await router.push("/login?redirect=/kitchen/make");
    throw new Error("Please log in to continue.");
  }

  const data = (await response.json()) as ServeResult & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? `Request failed: ${response.status}`);
  }

  return data;
}

function visibleRecommendations(turn: AssistantTurn): ServeRecommendation[] {
  return turn.result?.recommendations.slice(0, turn.visibleCount) ?? [];
}

function hasMoreRecommendations(turn: AssistantTurn): boolean {
  return (turn.result?.recommendations.length ?? 0) > 3;
}

function isExpanded(turn: AssistantTurn): boolean {
  const total = turn.result?.recommendations.length ?? 0;
  return turn.visibleCount >= total;
}

function toggleRecommendations(turn: AssistantTurn) {
  const total = turn.result?.recommendations.length ?? 0;
  if (total <= 3) return;
  turn.visibleCount = turn.visibleCount > 3 ? 3 : total;
}

function toCardItem(item: ServeRecommendation): CardItem {
  return {
    id: item.id,
    creatorName: item.creatorName,
    title: item.title,
    contentType: item.contentType,
    contentUrl: item.contentUrl || item.url || null,
    publishedAt: item.publishedAt,
    media: {
      url: item.media?.url ?? undefined,
      thumbnail: item.media?.thumbnail ?? undefined,
    },
  };
}

async function scrollToBottom() {
  await nextTick();
  const container = historyRef.value;
  if (!container) return;
  container.scrollTop = container.scrollHeight;
}

watch(
  turns,
  async () => {
    await scrollToBottom();
  },
  { deep: true },
);

onMounted(async () => {
  const session = await fetchAuthSession(API_BASE);
  if (!session) {
    await router.push("/login?redirect=/kitchen/make");
  }
});
</script>

<template>
  <div class="page make-page">
    <section class="chat-shell">
      <header class="chat-header">
        <div>
          <p class="eyebrow">Kitchen / Make</p>
          <h1 class="hero-title">Serve me soup</h1>
          <p class="hero-sub">
            Ask for the latest on any topic and get focused recommendations with
            links.
          </p>
        </div>
        <div class="header-actions">
          <RouterLink class="button ghost" to="/kitchen/make-legacy">
            Legacy builder
          </RouterLink>
          <button
            class="button ghost"
            type="button"
            :disabled="loading || !turns.length"
            @click="resetThread"
          >
            New thread
          </button>
        </div>
      </header>

      <div ref="historyRef" class="chat-history">
        <div v-if="!turns.length" class="empty-state">
          <p class="muted">
            Ask what you need. Example: "Give me the latest on AI agents for
            founders."
          </p>
        </div>

        <template v-for="turn in turns" :key="turn.id">
          <article v-if="turn.type === 'user'" class="turn user-turn">
            <p>{{ turn.prompt }}</p>
          </article>

          <article v-else class="turn assistant-turn">
            <p v-if="turn.loading" class="muted">Serving soup...</p>
            <p v-else-if="turn.error" class="error">{{ turn.error }}</p>
            <template v-else-if="turn.result">
              <p class="assistant-summary">{{ turn.result.summary }}</p>
              <p class="muted meta-row">
                mode: {{ turn.result.mode.behavior }} ·
                {{ turn.result.mode.intent }} ·
                {{ turn.result.coverage.windowDays }}d window ·
                {{ turn.result.coverage.recentMatches }} recent matches
              </p>

              <div class="recommendation-list">
                <article
                  v-for="item in visibleRecommendations(turn)"
                  :key="item.id"
                  class="recommendation-entry"
                >
                  <ContentCard :item="toCardItem(item)" />
                  <p class="small why">{{ item.why }}</p>
                </article>
              </div>

              <div class="result-actions">
                <button
                  v-if="hasMoreRecommendations(turn)"
                  class="button ghost small-button"
                  type="button"
                  @click="toggleRecommendations(turn)"
                >
                  {{ isExpanded(turn) ? "Show top 3" : "Show more" }}
                </button>
                <p class="muted small">All recommendations include direct links.</p>
              </div>

              <p v-if="turn.isSimmering" class="simmering">
                <span class="simmer-dot" />
                Simmering latest information...
              </p>
            </template>
          </article>
        </template>

        <p v-if="pageError" class="error">{{ pageError }}</p>
      </div>

      <form class="composer" @submit.prevent="submitPrompt">
        <textarea
          v-model="prompt"
          rows="3"
          placeholder="What soup do you want right now?"
          :disabled="loading"
        />
        <div class="composer-actions">
          <p class="muted small">
            Default: 7-day window, behavior-aware ranking, concise output.
          </p>
          <button
            class="button primary"
            type="submit"
            :disabled="loading || !prompt.trim()"
          >
            {{ loading ? "Serving..." : "serve me soup" }}
          </button>
        </div>
      </form>
    </section>
  </div>
</template>

<style scoped>
.make-page {
  gap: 24px;
}

.chat-shell {
  width: min(980px, 100%);
  margin: 0 auto;
  background: rgba(255, 250, 241, 0.8);
  border: 1px solid rgba(47, 42, 37, 0.14);
  border-radius: 24px;
  box-shadow: var(--shadow);
  display: grid;
  grid-template-rows: auto minmax(240px, 1fr) auto;
  min-height: calc(100vh - 180px);
  overflow: hidden;
}

.chat-header {
  padding: 22px 22px 16px;
  border-bottom: 1px solid rgba(47, 42, 37, 0.12);
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: flex-start;
  flex-wrap: wrap;
}

.chat-header .hero-title {
  font-size: clamp(30px, 3.8vw, 42px);
}

.chat-header .hero-sub {
  margin-bottom: 0;
  max-width: 620px;
  font-size: 16px;
}

.header-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.chat-history {
  padding: 18px 22px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.empty-state {
  border: 1px dashed rgba(47, 42, 37, 0.2);
  border-radius: 14px;
  padding: 16px;
}

.turn {
  border-radius: 14px;
  border: 1px solid rgba(47, 42, 37, 0.14);
  padding: 14px;
}

.user-turn {
  align-self: flex-end;
  max-width: 84%;
  background: rgba(47, 42, 37, 0.92);
  color: var(--white);
}

.user-turn p {
  margin: 0;
}

.assistant-turn {
  background: rgba(255, 250, 241, 0.95);
}

.assistant-summary {
  margin: 0 0 10px;
  font-weight: 600;
}

.meta-row {
  margin: 0 0 12px;
}

.recommendation-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px;
}

.recommendation-entry {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.small {
  font-size: 12px;
}

.why {
  margin: 0;
}

.why {
  color: var(--ink-soft);
}

.result-actions {
  margin-top: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.small-button {
  padding: 8px 14px;
  font-size: 12px;
}

.simmering {
  margin: 12px 0 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--river);
}

.simmer-dot {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: var(--river);
  box-shadow: 0 0 0 0 rgba(62, 107, 115, 0.5);
  animation: simmerPulse 1.2s ease infinite;
}

.composer {
  border-top: 1px solid rgba(47, 42, 37, 0.12);
  padding: 14px 22px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: rgba(255, 250, 241, 0.94);
}

.composer textarea {
  width: 100%;
  resize: vertical;
  min-height: 72px;
  border-radius: 12px;
  border: 1px solid rgba(47, 42, 37, 0.2);
  padding: 12px 14px;
  font-family: inherit;
  font-size: 14px;
  background: rgba(255, 250, 241, 0.98);
}

.composer textarea:focus-visible {
  outline: 2px solid rgba(62, 107, 115, 0.35);
  outline-offset: 1px;
}

.composer-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

@keyframes simmerPulse {
  0% {
    box-shadow: 0 0 0 0 rgba(62, 107, 115, 0.55);
  }
  100% {
    box-shadow: 0 0 0 10px rgba(62, 107, 115, 0);
  }
}

@media (max-width: 700px) {
  .chat-shell {
    min-height: calc(100vh - 120px);
  }

  .chat-header {
    padding: 18px 16px 14px;
  }

  .chat-history {
    padding: 14px 16px;
  }

  .composer {
    padding: 12px 16px 16px;
  }

  .user-turn {
    max-width: 100%;
  }
}
</style>
