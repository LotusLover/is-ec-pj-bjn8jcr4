import { createRouter, createWebHashHistory } from 'vue-router';
import VotePage from './pages/VotePage.vue';
import HostPage from './pages/HostPage.vue';

const routes = [
  { path: '/', redirect: '/vote' },
  { path: '/vote', component: VotePage },
  { path: '/host', component: HostPage },
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
});
