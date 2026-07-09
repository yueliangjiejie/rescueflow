import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';
import 'vant/lib/index.css';
import './assets/main.css';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('./views/Home.vue') },
    { path: '/register', name: 'register', component: () => import('./views/Register.vue') },
    { path: '/success/:code', name: 'success', component: () => import('./views/Success.vue'), props: true },
    { path: '/water-level', name: 'waterLevel', component: () => import('./views/WaterLevel.vue') },
    { path: '/safety', name: 'safety', component: () => import('./views/Safety.vue') },
    { path: '/feed', name: 'feed', component: () => import('./views/Feed.vue') },
    { path: '/offer', name: 'offer', component: () => import('./views/Offer.vue') },
    // —— 修复：补全缺失路由,让智能录入/我的/我发布的求助 可达 ——
    { path: '/intake', name: 'intake', component: () => import('./views/Intake.vue') },
    { path: '/my', name: 'my', component: () => import('./views/My.vue') },
    { path: '/my-matches', name: 'myMatches', component: () => import('./views/MyMatches.vue') },
    { path: '/my-helps', name: 'myHelps', component: () => import('./views/MyHelps.vue') },
  ],
});

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');
