<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { fetchAuthSession } from "../../lib/auth";

type SourceCandidate = {
  name: string;
  type: "video" | "audio" | "article";
  feedUrl: string;
  siteUrl?: string;
  confidence: number;
};

type SourceInput = {
  feedUrl: string;
  sourceType: "video" | "audio" | "article";
  name?: string;
  siteUrl?: string;
  confidence?: number;
};

const API_BASE =
  import.meta.env.VITE_SOUP_API_URL ??
  "https://thehumansoup-worker.kieranbutler.workers.dev";

const router = useRouter();
const step = ref(0);
const handle = ref("");
const handleError = ref<string | null>(null);
const searchQuery = ref("");
const searchResults = ref<SourceCandidate[]>([]);
const isSearching = ref(false);
const selectedSources = ref<SourceInput[]>([]);
const error = ref<string | null>(null);
const isSaving = ref(false);
const finalHandle = ref<string>("");
const showManualModal = ref(false);
const manualFeedUrl = ref("");
const manualName = ref("");
const manualType = ref<"article" | "audio" | "video">("article");
const manualError = ref<string | null>(null);

const steps = [
  { title: "Add ingredients", subtitle: "Search, add, and tweak sources." },
  { title: "Grab a bowl", subtitle: "Name the bowl and serve your soup." },
];

const canContinue = computed(() => {
  if (step.value === 0) return selectedSources.value.length > 0;
  if (step.value === 1) return handle.value.trim().length >= 3;
  return true;
});

const selectedPreview = computed(() =>
  selectedSources.value.map((source) => ({
    label: source.name?.trim() || domainFromUrl(source.feedUrl) || "New feed",
    type: source.sourceType,
  })),
);

function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

async function discoverSources() {
  if (!searchQuery.value.trim()) return;
  error.value = null;
  isSearching.value = true;
  try {
    const response = await fetch(
      `${API_BASE}/discover/sources?q=${encodeURIComponent(searchQuery.value)}`,
    );
    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`);
    }
    const data = await response.json();
    searchResults.value = data.candidates ?? [];
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Search failed.";
  } finally {
    isSearching.value = false;
  }
}

function addCandidate(candidate: SourceCandidate) {
  if (
    selectedSources.value.some((source) => source.feedUrl === candidate.feedUrl)
  ) {
    return;
  }
  selectedSources.value.push({
    feedUrl: candidate.feedUrl,
    sourceType: candidate.type,
    name: candidate.name,
    siteUrl: candidate.siteUrl,
    confidence: candidate.confidence,
  });
}

function addManualSource() {
  showManualModal.value = true;
  manualFeedUrl.value = "";
  manualName.value = "";
  manualType.value = "article";
  manualError.value = null;
}

function removeSource(index: number) {
  selectedSources.value.splice(index, 1);
}

function closeManualModal() {
  showManualModal.value = false;
  manualError.value = null;
}

function addManualFromModal() {
  const feedUrl = manualFeedUrl.value.trim();
  if (!feedUrl) {
    manualError.value = "Feed URL is required.";
    return;
  }
  selectedSources.value.push({
    feedUrl,
    sourceType: manualType.value,
    name: manualName.value.trim() || undefined,
  });
  closeManualModal();
}

async function saveSoup() {
  error.value = null;
  const session = await fetchAuthSession(API_BASE);
  if (!session) {
    router.push("/login?redirect=/kitchen/make-legacy");
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
        name: handle.value.trim() || undefined,
        displayName: handle.value.trim() || undefined,
        sources: selectedSources.value.map((source) => ({
          feedUrl: source.feedUrl.trim(),
          sourceType: source.sourceType,
          name: source.name?.trim() || undefined,
          siteUrl: source.siteUrl?.trim() || undefined,
          confidence: source.confidence ?? undefined,
        })),
      }),
    });

    if (response.status === 401) {
      router.push("/login?redirect=/kitchen/make-legacy");
      return;
    }

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to save soup");
    }
    const data = await response.json();
    finalHandle.value = cleanHandle(data.name);

    await router.push(`/soups/${finalHandle.value}`);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to make soup";
  } finally {
    isSaving.value = false;
  }
}

function nextStep() {
  if (!canContinue.value) return;
  if (step.value >= 1) return;
  step.value = 1;
  if (!handle.value.trim()) {
    handle.value = generateSoupHandle();
  }
}

function prevStep() {
  if (step.value === 0) return;
  step.value -= 1;
}

function cleanHandle(value: string): string {
  return value
    .toLowerCase()
    .replace(/@/g, "")
    .replace(/[^a-z0-9_-]/g, "");
}

watch(handle, (value) => {
  const cleaned = cleanHandle(value);
  if (cleaned !== value) {
    handle.value = cleaned;
    return;
  }
  handleError.value =
    cleaned.length > 0 && cleaned.length < 3
      ? "Handle must be at least 3 characters."
      : null;
  finalHandle.value = "";
});

watch(
  selectedSources,
  () => {
    finalHandle.value = "";
  },
  { deep: true },
);

function generateSoupHandle(): string {
  const adjectives = [
    "spicy",
    "misty",
    "golden",
    "wild",
    "electric",
    "cosmic",
    "silky",
    "bold",
    "gentle",
    "smoky",
  ];
  const nouns = ["broth", "stew", "soup", "chowder", "bisque"];
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return cleanHandle(`${adjective}-${noun}`);
}

function isSelected(candidate: SourceCandidate): boolean {
  return selectedSources.value.some(
    (source) => source.feedUrl === candidate.feedUrl,
  );
}

onMounted(async () => {
  const session = await fetchAuthSession(API_BASE);
  if (!session) {
    router.push("/login?redirect=/kitchen/make-legacy");
  }
});
</script>

<template>
  <div class="page make-page">
    <div class="beta-banner">
      <span class="beta-pill">Make</span>
      <span>Build your soup in minutes.</span>
    </div>

    <section class="hero soup-hero make-hero">
      <div class="make-hero-grid">
        <div class="make-hero-copy">
          <p class="eyebrow">Soup Wizard</p>
          <h1 class="hero-title">{{ steps[step].title }}</h1>
          <p class="hero-sub">{{ steps[step].subtitle }}</p>

          <div class="stepper">
            <div
              v-for="(s, index) in steps"
              :key="s.title"
              class="step"
              :class="{ active: index === step }"
            >
              <span class="step-index">{{ index + 1 }}</span>
              <span class="step-title">{{ s.title }}</span>
            </div>
          </div>
        </div>

        <div class="make-hero-summary">
          <h3>Ingredients</h3>
          <p class="muted">Everything you add shows up here.</p>
          <div v-if="selectedPreview.length" class="ingredient-list">
            <div
              v-for="(item, index) in selectedPreview"
              :key="`${item.label}-${index}`"
              class="ingredient-row"
            >
              <span>{{ item.label }}</span>
              <div class="ingredient-meta">
                <span class="badge">{{ item.type }}</span>
                <button
                  class="ingredient-remove"
                  type="button"
                  @click="removeSource(index)"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
          <p v-else class="muted">No ingredients yet.</p>
        </div>
      </div>
    </section>

    <section class="section">
      <p v-if="error" class="error">{{ error }}</p>

      <div v-if="step === 1" class="wizard-card">
        <label class="field">
          <span>Name your soup</span>
          <input v-model="handle" placeholder="kierans-soup" />
        </label>
        <p v-if="handleError" class="error">{{ handleError }}</p>
        <div class="callout-actions">
          <button
            class="button primary"
            type="button"
            :disabled="!canContinue || isSaving"
            @click="saveSoup"
          >
            {{ isSaving ? "Serving..." : "Serve me my soup" }}
          </button>
        </div>
      </div>

      <div v-else-if="step === 0" class="wizard-card">
        <div class="search-row">
          <input
            v-model="searchQuery"
            placeholder="Search a person, podcast, blog or YouTube channel you enjoy."
          />
          <button
            class="button primary"
            type="button"
            :disabled="isSearching"
            @click="discoverSources"
          >
            {{ isSearching ? "Searching..." : "Find ingredients" }}
          </button>
        </div>
        <div class="result-grid">
          <div
            v-for="candidate in searchResults"
            :key="candidate.feedUrl"
            class="result-card"
          >
            <p class="result-title">{{ candidate.name }}</p>
            <p class="muted">{{ candidate.feedUrl }}</p>
            <span class="badge">{{ candidate.type }}</span>
            <button
              class="button ghost"
              type="button"
              :disabled="isSelected(candidate)"
              @click="addCandidate(candidate)"
            >
              {{ isSelected(candidate) ? "Added" : "Add" }}
            </button>
          </div>
        </div>
        <div class="wizard-header">
          <button class="button ghost" type="button" @click="addManualSource">
            Add feed manually
          </button>
        </div>
      </div>
    </section>

    <div
      v-if="showManualModal"
      class="modal-overlay"
      @click.self="closeManualModal"
    >
      <div class="modal-card">
        <h3>Add a feed</h3>
        <p class="muted">
          Drop in a feed URL and we’ll treat it as an ingredient.
        </p>
        <label class="field">
          <span>Name (optional)</span>
          <input v-model="manualName" placeholder="Creator or channel name" />
        </label>
        <label class="field">
          <span>Feed URL</span>
          <input
            v-model="manualFeedUrl"
            placeholder="https://username.substack.com/feed"
          />
        </label>
        <label class="field">
          <span>Type</span>
          <select v-model="manualType">
            <option value="article">Article</option>
            <option value="audio">Audio</option>
            <option value="video">Video</option>
          </select>
        </label>
        <p v-if="manualError" class="error">{{ manualError }}</p>
        <div class="callout-actions">
          <button class="button ghost" type="button" @click="closeManualModal">
            Cancel
          </button>
          <button
            class="button primary"
            type="button"
            @click="addManualFromModal"
          >
            Add feed
          </button>
        </div>
      </div>
    </div>

    <section v-if="step === 0" class="section wizard-footer">
      <div class="nav-row">
        <button
          class="button ghost"
          type="button"
          :disabled="step === 0"
          @click="prevStep"
        >
          Back
        </button>
        <button
          class="button primary"
          type="button"
          :disabled="!canContinue"
          @click="nextStep"
        >
          Grab a bowl
        </button>
      </div>
    </section>
  </div>
</template>
