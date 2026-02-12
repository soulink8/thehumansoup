<script setup lang="ts">
import { onMounted } from "vue";
import { useRouter } from "vue-router";

const router = useRouter();

onMounted(() => {
  router.replace("/soups/demo");
});
</script>

<template>
  <div class="page">
    <section class="section">
      <p class="muted">Redirecting...</p>
    </section>
  </div>
</template>
