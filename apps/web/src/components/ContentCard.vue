<script setup lang="ts">
import { computed } from "vue";

type ContentItem = {
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

const props = defineProps<{
  item: ContentItem;
}>();

const link = computed(() => props.item.media?.url || props.item.contentUrl || "");
const hasLink = computed(() => Boolean(link.value));

const displayType = computed(() => {
  const raw = props.item.contentType?.toLowerCase() ?? "content";
  if (raw === "audio") return "podcast";
  return raw;
});

const displayDate = computed(() => {
  if (!props.item.publishedAt) return "";
  const date = new Date(props.item.publishedAt);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
});

const thumbUrl = computed(() => props.item.media?.thumbnail || "");
const thumbStyle = computed(() =>
  thumbUrl.value ? { "--thumb-url": `url(${thumbUrl.value})` } : {},
);
</script>

<template>
  <component
    :is="hasLink ? 'a' : 'article'"
    class="content-card"
    :class="{ 'has-thumb': Boolean(thumbUrl) }"
    :data-type="displayType"
    :href="hasLink ? link : undefined"
    :target="hasLink ? '_blank' : undefined"
    :rel="hasLink ? 'noreferrer' : undefined"
    :style="thumbStyle"
  >
    <div class="content-meta">
      <span class="content-type">{{ displayType }}</span>
      <span v-if="displayDate" class="content-date">{{ displayDate }}</span>
    </div>
    <h4 class="content-title">{{ item.title }}</h4>
    <p class="content-author">{{ item.creatorName }}</p>
  </component>
</template>
