<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { fetchAuthSession, logout } from "../lib/auth";

const API_BASE =
  import.meta.env.VITE_SOUP_API_URL ??
  "https://thehumansoup-worker.kieranbutler.workers.dev";

const route = useRoute();
const router = useRouter();

const isAuthed = ref(false);
const userLabel = ref<string | null>(null);

async function refreshAuth() {
  const user = await fetchAuthSession(API_BASE);
  isAuthed.value = Boolean(user);

  if (user?.displayName) {
    userLabel.value = user.displayName;
    return;
  }
  if (user?.handle) {
    userLabel.value = `@${String(user.handle).replace(/^@/, "")}`;
    return;
  }
  if (user?.email) {
    userLabel.value = user.email;
    return;
  }
  userLabel.value = null;
}

async function handleLogout() {
  await logout(API_BASE);
  await refreshAuth();
  router.push("/");
}

onMounted(() => {
  void refreshAuth();
  window.addEventListener("storage", refreshAuth);
});

onBeforeUnmount(() => {
  window.removeEventListener("storage", refreshAuth);
});

watch(
  () => route.fullPath,
  () => {
    void refreshAuth();
  },
);
</script>

<template>
  <header class="site-header">
    <div class="site-header-inner">
      <RouterLink to="/" class="brand">
        <span class="brand-title">Human Soup</span>
      </RouterLink>
      <nav class="site-nav" aria-label="Primary">
        <RouterLink to="/" class="nav-link">Home</RouterLink>
        <RouterLink to="/make" class="nav-link">Make</RouterLink>
        <RouterLink v-if="isAuthed" to="/kitchen" class="nav-link">Kitchen</RouterLink>
        <span v-if="isAuthed && userLabel" class="nav-user">{{ userLabel }}</span>
        <RouterLink v-if="!isAuthed" to="/login" class="nav-link nav-cta">
          Sign in
        </RouterLink>
        <button v-else class="nav-link nav-cta" type="button" @click="handleLogout">
          Sign out
        </button>
      </nav>
    </div>
  </header>
</template>
