<script setup lang="ts">
import type { AuthUser } from "../lib/auth";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { fetchAuthSession, logout } from "../lib/auth";

const API_BASE =
  import.meta.env.VITE_SOUP_API_URL ??
  "https://thehumansoup-worker.kieranbutler.workers.dev";

const route = useRoute();
const router = useRouter();

const isAuthed = ref(false);
const authUser = ref<AuthUser | null>(null);
const accountMenuOpen = ref(false);

function userLabel(user: AuthUser | null): string {
  if (!user) return "Account";
  if (user.displayName) return user.displayName;
  if (user.handle) return `@${String(user.handle).replace(/^@/, "")}`;
  if (user.email) return user.email;
  return "Account";
}

async function refreshAuth() {
  const user = await fetchAuthSession(API_BASE);
  isAuthed.value = Boolean(user);
  authUser.value = user;
}

function toggleAccountMenu() {
  accountMenuOpen.value = !accountMenuOpen.value;
}

function closeAccountMenu() {
  accountMenuOpen.value = false;
}

function onDocumentClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null;
  if (!target) return;
  if (!target.closest(".account-dropdown")) {
    closeAccountMenu();
  }
}

async function handleLogout() {
  closeAccountMenu();
  await logout(API_BASE);
  await refreshAuth();
  router.push("/");
}

onMounted(() => {
  void refreshAuth();
  window.addEventListener("storage", refreshAuth);
  document.addEventListener("click", onDocumentClick);
});

onBeforeUnmount(() => {
  window.removeEventListener("storage", refreshAuth);
  document.removeEventListener("click", onDocumentClick);
});

watch(
  () => route.fullPath,
  () => {
    void refreshAuth();
    closeAccountMenu();
  },
);
</script>

<template>
  <header class="site-header">
    <div class="site-header-inner">
      <RouterLink to="/" class="brand">
        <span class="brand-title">The Soup</span>
      </RouterLink>
      <nav class="site-nav" aria-label="Primary">
        <RouterLink v-if="isAuthed" to="/kitchen" class="nav-link"
          >Kitchen</RouterLink
        >
        <RouterLink v-if="!isAuthed" to="/login" class="nav-link nav-cta">
          Sign in
        </RouterLink>
        <div v-else class="account-dropdown">
          <button
            class="account-btn"
            type="button"
            aria-haspopup="menu"
            :aria-expanded="accountMenuOpen ? 'true' : 'false'"
            @click="toggleAccountMenu"
          >
            {{ userLabel(authUser) }} ▾
          </button>
          <div v-if="accountMenuOpen" class="dropdown-menu" role="menu">
            <RouterLink
              to="/account"
              class="dropdown-email"
              @click="closeAccountMenu"
            >
              {{ authUser?.email || userLabel(authUser) }}
            </RouterLink>
            <div class="dropdown-sep" />
            <RouterLink
              to="/account"
              class="dropdown-item"
              @click="closeAccountMenu"
            >
              Account page
            </RouterLink>
            <button
              class="dropdown-item danger"
              type="button"
              @click="handleLogout"
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>
    </div>
  </header>
</template>
