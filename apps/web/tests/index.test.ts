import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createRouter, createMemoryHistory } from "vue-router";
import Index from "./index.vue";

const mockStats = {
  creators: 42,
  content: 1234,
  subscriptions: 56,
  topics: 12,
  lastCrawl: "2026-02-11T10:00:00Z",
};

const mockContent = [
  {
    id: "1",
    creatorId: "c1",
    creatorHandle: "alice",
    creatorName: "Alice",
    slug: "my-post",
    title: "Test Post",
    excerpt: "A test",
    contentType: "article",
    contentUrl: "https://example.com/post",
    publishedAt: "2026-02-10T12:00:00Z",
  },
];

function createMockFetch(responses: Record<string, unknown>) {
  return vi.fn((url: string) => {
    const path = url.replace(/^https?:\/\/[^/]+/, "");
    const response = responses[path] ?? responses[url];
    if (response === undefined) {
      return Promise.resolve({ ok: false, status: 404 });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(response),
    });
  });
}

vi.mock("typed.js", () => ({
  default: vi.fn().mockImplementation(() => ({
    destroy: vi.fn(),
  })),
}));

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true })), // prefers-reduced-motion: reduce
  );
});

describe("Index", () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", component: Index },
      { path: "/kitchen/make", component: { template: "<div>Make</div>" } },
      { path: "/login", component: { template: "<div>Login</div>" } },
      { path: "/soups/:name", component: { template: "<div>Soup</div>" } },
    ],
  });

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      createMockFetch({
        "/stats": mockStats,
        "/discover/content?limit=6&offset=0": { content: mockContent },
      }),
    );
  });

  it("renders hero section with title and CTA links", async () => {
    const wrapper = mount(Index, {
      global: {
        plugins: [router],
      },
    });

    await router.isReady();

    expect(wrapper.text()).toContain("The Human Soup");
    expect(wrapper.text()).toContain("The place agents swim for");
    expect(wrapper.text()).toContain("content.");
    expect(wrapper.text()).toContain("Make my soup");
    expect(wrapper.text()).not.toContain("Serve me soup");
  });

  it("loads and displays stats after mount", async () => {
    const wrapper = mount(Index, {
      global: {
        plugins: [router],
      },
    });

    await router.isReady();
    await new Promise((r) => setTimeout(r, 50));

    expect(wrapper.text()).toContain("42");
    expect(wrapper.text()).toContain("1,234");
    expect(wrapper.text()).toContain("56");
  });

  it("loads and displays latest content", async () => {
    const wrapper = mount(Index, {
      global: { plugins: [router] },
    });

    await router.isReady();
    await new Promise((r) => setTimeout(r, 50));

    expect(wrapper.text()).toContain("Alice");
    expect(wrapper.text()).toContain("1 items");
  });

  it("displays error when stats fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("/stats")) {
          return Promise.resolve({ ok: false, status: 404 });
        }
        if (url.includes("/discover")) {
          return Promise.resolve({ ok: true, json: () => ({ content: [] }) });
        }
        return Promise.resolve({ ok: false, status: 404 });
      }),
    );

    const wrapper = mount(Index, {
      global: {
        plugins: [router],
      },
    });

    await router.isReady();
    await new Promise((r) => setTimeout(r, 50));

    expect(wrapper.find(".error").exists()).toBe(true);
    expect(wrapper.find(".error").text()).toContain("Request failed");
  });

  it("renders RouterLinks to make and login", async () => {
    const wrapper = mount(Index, {
      global: {
        plugins: [router],
      },
    });

    await router.isReady();

    const makeLink = wrapper.find('a[href="/kitchen/make"]');
    const loginLink = wrapper.find('a[href="/login"]');

    expect(makeLink.exists()).toBe(true);
    expect(loginLink.exists()).toBe(true);
  });

  it("formats last crawl date in stats", async () => {
    const wrapper = mount(Index, {
      global: {
        plugins: [router],
      },
    });

    await router.isReady();
    await new Promise((r) => setTimeout(r, 50));

    expect(wrapper.text()).toMatch(/Feb.*11/);
  });

  it("renders creators login CTA section", async () => {
    const wrapper = mount(Index, {
      global: {
        plugins: [router],
      },
    });

    await router.isReady();

    expect(wrapper.text()).toContain("Attention Creators");
    expect(wrapper.text()).toContain("Add your spice to THE HUMAN SOUP");
    expect(wrapper.text()).toContain("Sign in");
  });
});
