import { createRouter, createWebHistory } from "vue-router";
import HomeView from "./views/HomeView.vue";
import MySoupView from "./views/MySoupView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "home", component: HomeView },
    { path: "/@:handle", name: "my-soup", component: MySoupView },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});

export default router;
