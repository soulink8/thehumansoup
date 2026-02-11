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

const displayType = computed(() => {
  const raw = props.item.contentType?.toLowerCase() ?? "content";
  if (raw === "audio") return "podcast";
  return raw;
});

const link = computed(() => {
  const contentUrl = props.item.contentUrl?.trim() ?? "";
  if (contentUrl) return contentUrl;

  if (displayType.value === "video" || displayType.value === "podcast") {
    return props.item.media?.url?.trim() ?? "";
  }

  return "";
});

const hasLink = computed(() => Boolean(link.value));

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
</script>

<template>
  <component
    :is="hasLink ? 'a' : 'article'"
    class="content-card"
    :data-type="displayType"
    :href="hasLink ? link : undefined"
    :target="hasLink ? '_blank' : undefined"
    :rel="hasLink ? 'noreferrer' : undefined"
  >
    <div v-if="thumbUrl" class="content-thumb">
      <img :src="thumbUrl" alt="" loading="lazy" />
    </div>
    <div class="content-body">
      <div class="content-meta">
        <span class="content-type">{{ displayType }}</span>
        <span v-if="displayDate" class="content-date">{{ displayDate }}</span>
      </div>
      <h4 class="content-title">{{ item.title }}</h4>
      <p class="content-author">{{ item.creatorName }}</p>
    </div>
  </component>
</template>
