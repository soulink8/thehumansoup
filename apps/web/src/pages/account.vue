<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { fetchAuthSession } from "../lib/auth";

const API_BASE =
  import.meta.env.VITE_SOUP_API_URL ??
  "https://thehumansoup-worker.kieranbutler.workers.dev";

const router = useRouter();
const user = ref<{
  id?: string;
  email?: string | null;
  displayName?: string | null;
  handle?: string | null;
  me3SiteUrl?: string | null;
} | null>(null);
const loading = ref(true);

onMounted(async () => {
  const session = await fetchAuthSession(API_BASE);
  if (!session) {
    router.push("/login?redirect=/account");
    return;
  }
  user.value = session;
  loading.value = false;
});
</script>

<template>
  <div class="page">
    <div class="section">
      <h1>Account</h1>
      <p class="muted">Your account details</p>

      <div v-if="loading" class="panel">
        <p class="muted">Loading...</p>
      </div>

      <div v-else-if="user" class="panel">
        <dl class="account-details">
          <div v-if="user.email" class="detail-row">
            <dt>Email</dt>
            <dd>{{ user.email }}</dd>
          </div>
          <div v-if="user.displayName" class="detail-row">
            <dt>Display name</dt>
            <dd>{{ user.displayName }}</dd>
          </div>
          <div v-if="user.handle" class="detail-row">
            <dt>Handle</dt>
            <dd>@{{ String(user.handle).replace(/^@/, "") }}</dd>
          </div>
          <div v-if="user.me3SiteUrl" class="detail-row">
            <dt>ME3 site</dt>
            <dd>
              <a :href="user.me3SiteUrl" target="_blank" rel="noopener">{{
                user.me3SiteUrl
              }}</a>
            </dd>
          </div>
          <div v-if="user.id" class="detail-row">
            <dt>ID</dt>
            <dd class="mono">{{ user.id }}</dd>
          </div>
        </dl>
      </div>
    </div>
  </div>
</template>

<style scoped>
.account-details {
  display: flex;
  flex-direction: column;
  gap: 18px;
  margin: 0;
}

.detail-row {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 16px;
  align-items: baseline;
}

.detail-row dt {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--ink-soft);
  font-weight: 600;
  margin: 0;
}

.detail-row dd {
  margin: 0;
  font-size: 15px;
}

.mono {
  font-family: "Space Grotesk", monospace;
  font-size: 13px;
  word-break: break-all;
}

.detail-row a {
  color: var(--river);
  text-decoration: underline;
}

.detail-row a:hover {
  opacity: 0.85;
}
</style>
