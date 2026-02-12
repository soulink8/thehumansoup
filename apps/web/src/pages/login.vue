<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { fetchAuthSession, setAuthUser } from "../lib/auth";

const API_BASE =
  import.meta.env.VITE_SOUP_API_URL ??
  "https://thehumansoup-worker.kieranbutler.workers.dev";

const router = useRouter();
const route = useRoute();

const email = ref("");
const codeSent = ref(false);
const loading = ref(false);
const error = ref("");

const codeDigits = ref(["", "", "", "", "", ""]);
const codeInputRefs = ref<HTMLInputElement[]>([]);

const oauthErrorMessages: Record<string, string> = {
  oauth_denied: "Google login was cancelled.",
  missing_params: "Google login failed. Please try again.",
  invalid_state: "Google login expired. Please try again.",
  token_exchange_failed: "Could not complete Google login. Please try again.",
  user_info_failed: "Could not read your Google profile. Please try again.",
  oauth_not_configured: "Google login is not configured yet.",
  database_error: "Could not sign you in. Please try again.",
};

function sanitizeRedirect(redirect: string | null): string {
  if (!redirect || !redirect.startsWith("/") || redirect.startsWith("//")) {
    return "/kitchen";
  }
  return redirect;
}

function redirectAfterLogin() {
  const redirectParam =
    typeof route.query.redirect === "string" ? route.query.redirect : null;
  router.push(sanitizeRedirect(redirectParam));
}

function startGoogleOAuth() {
  if (loading.value) return;
  const redirectParam =
    typeof route.query.redirect === "string" ? route.query.redirect : null;
  const redirect = sanitizeRedirect(redirectParam);
  window.location.href = `${API_BASE}/auth/google/authorize?redirect=${encodeURIComponent(redirect)}`;
}

async function requestCode() {
  if (!email.value || loading.value) return;

  loading.value = true;
  error.value = "";

  try {
    const response = await fetch(`${API_BASE}/auth/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.value }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to send code");
    }

    codeSent.value = true;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to send code.";
  } finally {
    loading.value = false;
  }
}

function handleCodeInput(index: number, event: Event) {
  const input = event.target as HTMLInputElement;
  const value = input.value;

  if (value && !/^\d$/.test(value)) {
    codeDigits.value[index] = "";
    return;
  }

  codeDigits.value[index] = value;

  if (value && index < 5) {
    codeInputRefs.value[index + 1]?.focus();
  }

  if (codeDigits.value.every((d) => d.length === 1)) {
    submitCode();
  }
}

function handleKeydown(index: number, event: KeyboardEvent) {
  if (event.key === "Backspace" && !codeDigits.value[index] && index > 0) {
    codeInputRefs.value[index - 1]?.focus();
  }
}

function handlePaste(event: ClipboardEvent) {
  event.preventDefault();
  const paste = event.clipboardData?.getData("text") || "";
  const digits = paste.replace(/\D/g, "").slice(0, 6).split("");

  digits.forEach((digit, i) => {
    codeDigits.value[i] = digit;
  });

  const focusIndex = Math.min(digits.length, 5);
  codeInputRefs.value[focusIndex]?.focus();

  if (digits.length === 6) {
    submitCode();
  }
}

async function submitCode() {
  const fullCode = codeDigits.value.join("");
  if (fullCode.length !== 6 || loading.value) return;

  loading.value = true;
  error.value = "";

  try {
    const response = await fetch(`${API_BASE}/auth/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email: email.value, code: fullCode }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Invalid or expired code");
    }

    const data = await response.json();
    setAuthUser({
      id: data.user?.id,
      email: data.user?.email,
      me3SiteUrl: data.user?.me3SiteUrl ?? null,
      handle: data.user?.handle ?? null,
      displayName: data.user?.displayName ?? null,
    });

    redirectAfterLogin();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Invalid code.";
    codeDigits.value = ["", "", "", "", "", ""];
    codeInputRefs.value[0]?.focus();
  } finally {
    loading.value = false;
  }
}

function changeEmail() {
  codeSent.value = false;
  codeDigits.value = ["", "", "", "", "", ""];
  error.value = "";
}

onMounted(() => {
  void (async () => {
    const session = await fetchAuthSession(API_BASE);
    if (session) {
      redirectAfterLogin();
      return;
    }

    const oauthError =
      typeof route.query.error === "string" ? route.query.error : "";
    if (oauthError) {
      error.value =
        oauthErrorMessages[oauthError] ||
        "Google login failed. Please try again.";

      const nextQuery = { ...route.query };
      delete nextQuery.error;
      await router.replace({ query: nextQuery });
    }
  })();
});
</script>

<template>
  <div class="login">
    <section class="login-card">
      <h1 class="title">{{ codeSent ? "Enter your code" : "Sign in" }}</h1>

      <p class="subtitle" v-if="codeSent">
        We sent a 6-digit code to <strong>{{ email }}</strong>
      </p>

      <form v-if="!codeSent" class="form" @submit.prevent="requestCode">
        <input
          v-model="email"
          type="email"
          placeholder="you@example.com"
          class="input"
          required
          autofocus
        />

        <button class="button primary" type="submit" :disabled="loading">
          {{ loading ? "Sending..." : "Send code" }}
        </button>
      </form>

      <div v-if="!codeSent" class="divider">
        <span>or</span>
      </div>

      <div v-if="!codeSent" class="oauth-buttons">
        <button type="button" class="oauth-button" @click="startGoogleOAuth">
          <svg class="oauth-icon" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continue with Google
        </button>
      </div>

      <div v-else class="code-form">
        <div class="code-inputs" @paste="handlePaste">
          <input
            v-for="(_, index) in 6"
            :key="index"
            :ref="
              (el) => {
                if (el) codeInputRefs[index] = el as HTMLInputElement;
              }
            "
            v-model="codeDigits[index]"
            type="text"
            inputmode="numeric"
            maxlength="1"
            class="code-input"
            @input="handleCodeInput(index, $event)"
            @keydown="handleKeydown(index, $event)"
          />
        </div>

        <button
          type="button"
          class="button primary"
          :disabled="loading || codeDigits.some((digit) => !digit)"
          @click="submitCode"
        >
          {{ loading ? "Verifying..." : "Verify" }}
        </button>

        <button type="button" class="link-button" @click="changeEmail">
          Use a different email
        </button>
      </div>

      <p v-if="error" class="error">{{ error }}</p>
    </section>
  </div>
</template>

<style scoped>
.login {
  min-height: calc(100vh - 80px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 28px 20px 56px;
}

.login-card {
  width: 100%;
  max-width: 420px;
  text-align: center;
  background: rgba(255, 250, 241, 0.86);
  border: 1px solid rgba(47, 42, 37, 0.14);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow);
  padding: 28px;
}

.title {
  font-size: clamp(28px, 5vw, 36px);
  margin-bottom: 8px;
}

.subtitle {
  color: var(--ink-soft);
  margin-bottom: 28px;
}

.subtitle strong {
  color: var(--ink);
}

.form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.input {
  width: 100%;
  padding: 14px;
  border: 1px solid var(--stroke);
  border-radius: var(--radius-sm);
  background: rgba(255, 250, 241, 0.9);
  font-size: 16px;
  font-family: inherit;
  color: var(--ink);
  outline: none;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.input:focus {
  border-color: var(--ink);
  box-shadow: 0 0 0 3px rgba(47, 42, 37, 0.1);
}

.button {
  border: none;
  border-radius: 12px;
  padding: 14px;
  font-size: 15px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    opacity 0.2s ease;
}

.button.primary {
  background: var(--ink);
  color: var(--white);
}

.button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 14px rgba(47, 42, 37, 0.2);
}

.button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.divider {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 18px 0;
  color: var(--ink-soft);
  font-size: 14px;
}

.divider::before,
.divider::after {
  content: "";
  flex: 1;
  height: 1px;
  background: rgba(47, 42, 37, 0.18);
}

.oauth-buttons {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.oauth-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  padding: 13px 14px;
  border-radius: 12px;
  border: 1px solid var(--stroke);
  background: rgba(255, 250, 241, 0.95);
  color: var(--ink);
  font-size: 15px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    transform 0.2s ease;
}

.oauth-button:hover {
  border-color: var(--ink);
  transform: translateY(-1px);
}

.oauth-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.code-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.code-inputs {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 8px;
}

.code-input {
  width: 100%;
  height: 52px;
  text-align: center;
  font-size: 22px;
  font-weight: 600;
  border: 1px solid var(--stroke);
  border-radius: 10px;
  background: rgba(255, 250, 241, 0.95);
  color: var(--ink);
  outline: none;
}

.code-input:focus {
  border-color: var(--ink);
  box-shadow: 0 0 0 3px rgba(47, 42, 37, 0.1);
}

.link-button {
  border: none;
  background: none;
  color: var(--ink-soft);
  font-size: 14px;
  cursor: pointer;
  text-decoration: underline;
  font-family: inherit;
}

.link-button:hover {
  color: var(--ink);
}

.error {
  margin-top: 16px;
  font-size: 14px;
  color: #a74732;
}

@media (max-width: 480px) {
  .login-card {
    padding: 24px 18px;
  }

  .code-input {
    height: 48px;
    font-size: 20px;
  }
}
</style>
