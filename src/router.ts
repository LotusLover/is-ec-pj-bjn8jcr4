import { createRouter, createWebHashHistory } from 'vue-router';
import VotePage from './pages/VotePage.vue';
import HostPage from './pages/HostPage.vue';

const routes = [
  { path: '/', redirect: '/vote' },
  { path: '/vote', component: VotePage },
  { path: '/host', component: HostPage },
  // 未定義のパスはすべて投票ページへ
  { path: '/:pathMatch(.*)*', redirect: '/vote' },
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
});
