import { createRouter, createWebHistory } from "vue-router";
import { routes } from "vue-router/auto-routes";

const router = createRouter({
  history: createWebHistory(),
  routes: [...routes, { path: "/:pathMatch(.*)*", redirect: "/" }],
});

export default router;
