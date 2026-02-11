<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { getAuthToken, setAuthToken, setAuthUser } from "../lib/auth";

const API_BASE =
  import.meta.env.VITE_SOUP_API_URL ??
  "https://thehumansoup-worker.kieranbutler.workers.dev";

const router = useRouter();
const route = useRoute();

const mode = ref<"email" | "me3">("email");

const email = ref("");
const codeSent = ref(false);
const loading = ref(false);
const error = ref("");

const codeDigits = ref(["", "", "", "", "", ""]);
const codeInputRefs = ref<HTMLInputElement[]>([]);

const me3SiteUrl = ref("");
const me3Token = ref("");
const me3Loading = ref(false);
const me3Error = ref("");

function redirectAfterLogin() {
  const redirect = (route.query.redirect as string) || "/kitchen";
  router.push(redirect);
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
      body: JSON.stringify({ email: email.value, code: fullCode }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Invalid or expired code");
    }

    const data = await response.json();
    setAuthToken(data.token);
    setAuthUser({
      id: data.user?.id,
      email: data.user?.email,
      me3SiteUrl: data.user?.me3SiteUrl ?? null,
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

async function submitMe3() {
  if (!me3SiteUrl.value.trim() || !me3Token.value.trim() || me3Loading.value) {
    return;
  }

  me3Loading.value = true;
  me3Error.value = "";

  try {
    const response = await fetch(`${API_BASE}/auth/me3`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteUrl: me3SiteUrl.value.trim(),
        token: me3Token.value.trim(),
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to link me3");
    }

    const data = await response.json();
    setAuthToken(data.token);
    setAuthUser({
      id: data.user?.id,
      email: data.user?.email,
      me3SiteUrl: data.user?.me3SiteUrl ?? null,
      handle: data.me3Profile?.handle ?? null,
      displayName: data.me3Profile?.displayName ?? null,
    });

    redirectAfterLogin();
  } catch (err) {
    me3Error.value = err instanceof Error ? err.message : "Failed to link me3.";
  } finally {
    me3Loading.value = false;
  }
}

onMounted(() => {
  const token = getAuthToken();
  if (token) {
    redirectAfterLogin();
    return;
  }

  if (route.query.mode === "me3") {
    mode.value = "me3";
  }
});
</script>

<template>
  <div class="page">
    <section class="login-shell">
      <div class="login-tabs">
        <button
          class="tab-button"
          :class="{ active: mode === 'email' }"
          @click="mode = 'email'"
          type="button"
        >
          Email code
        </button>
        <button
          class="tab-button"
          :class="{ active: mode === 'me3' }"
          @click="mode = 'me3'"
          type="button"
        >
          Link me3 account
        </button>
      </div>

      <div class="wizard-card" v-if="mode === 'email'">
        <h2>{{ codeSent ? "Enter your code" : "Sign in" }}</h2>
        <p v-if="codeSent" class="muted">
          We sent a 6-digit code to <strong>{{ email }}</strong
          >.
        </p>

        <form v-if="!codeSent" class="form" @submit.prevent="requestCode">
          <label class="field">
            Email
            <input
              v-model="email"
              type="email"
              placeholder="you@example.com"
              required
              autofocus
            />
          </label>
          <button class="button primary" type="submit" :disabled="loading">
            {{ loading ? "Sending..." : "Send code" }}
          </button>
        </form>

        <div v-else class="code-inputs" @paste="handlePaste">
          <input
            v-for="(_, index) in codeDigits"
            :key="index"
            ref="codeInputRefs"
            v-model="codeDigits[index]"
            class="code-input"
            maxlength="1"
            inputmode="numeric"
            @input="handleCodeInput(index, $event)"
            @keydown="handleKeydown(index, $event)"
          />
        </div>

        <div v-if="codeSent" class="code-actions">
          <button class="button ghost" type="button" @click="changeEmail">
            Use a different email
          </button>
        </div>

        <p v-if="error" class="error">{{ error }}</p>
      </div>

      <div class="wizard-card" v-else>
        <h2>Link your me3 account</h2>
        <p class="muted">
          Generate a Human Soup token inside me3, then paste it here with your
          site URL.
        </p>

        <form class="form" @submit.prevent="submitMe3">
          <label class="field">
            me3 site URL
            <input
              v-model="me3SiteUrl"
              type="url"
              placeholder="https://yourname.me3.app"
              required
            />
          </label>
          <label class="field">
            Human Soup token
            <input
              v-model="me3Token"
              type="text"
              placeholder="Paste your token"
              required
            />
          </label>
          <button class="button primary" type="submit" :disabled="me3Loading">
            {{ me3Loading ? "Linking..." : "Link me3" }}
          </button>
        </form>

        <p v-if="me3Error" class="error">{{ me3Error }}</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.login-hero {
  gap: 16px;
}

.login-shell {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.login-tabs {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.tab-button {
  border-radius: 999px;
  border: 1px solid rgba(47, 42, 37, 0.2);
  padding: 10px 18px;
  background: rgba(255, 250, 241, 0.8);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  color: var(--ink-soft);
}

.tab-button.active {
  background: var(--ink);
  color: var(--white);
  border-color: var(--ink);
}

.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.code-inputs {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 10px;
}

.code-input {
  text-align: center;
  font-size: 18px;
  padding: 12px 0;
  border-radius: 12px;
  border: 1px solid rgba(47, 42, 37, 0.2);
  background: rgba(255, 250, 241, 0.8);
}

.code-actions {
  display: flex;
  justify-content: flex-start;
}

.error {
  color: #a74732;
  font-size: 13px;
}

.muted {
  color: var(--ink-soft);
  font-size: 13px;
}
</style>
