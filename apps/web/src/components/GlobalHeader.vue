<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { clearAuth, getAuthToken, getAuthUser } from "../lib/auth";

const route = useRoute();
const router = useRouter();

const isAuthed = ref(false);
const userLabel = ref<string | null>(null);

function refreshAuth() {
  const token = getAuthToken();
  isAuthed.value = Boolean(token);

  const user = getAuthUser();
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

function handleLogout() {
  clearAuth();
  refreshAuth();
  router.push("/");
}

onMounted(() => {
  refreshAuth();
  window.addEventListener("storage", refreshAuth);
});

onBeforeUnmount(() => {
  window.removeEventListener("storage", refreshAuth);
});

watch(
  () => route.fullPath,
  () => {
    refreshAuth();
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
