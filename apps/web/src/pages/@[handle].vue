<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();

const legacyHandle = computed(() =>
  String(route.params.handle || "").trim().replace(/^@+/, "").toLowerCase(),
);

onMounted(() => {
  if (!legacyHandle.value) {
    router.replace("/");
    return;
  }
  router.replace(`/soups/${legacyHandle.value}`);
});
</script>

<template>
  <div class="page">
    <section class="section">
      <p class="muted">Redirecting...</p>
    </section>
  </div>
</template>
