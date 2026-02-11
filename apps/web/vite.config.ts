import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import VueRouter from "unplugin-vue-router/vite";

export default defineConfig({
  plugins: [
    VueRouter({
      routesFolder: "src/pages",
      dts: "src/typed-router.d.ts",
    }),
    vue(),
  ],
});
