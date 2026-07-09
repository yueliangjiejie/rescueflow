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
    { path: '/my-matches', name: 'myMatches', component: () => import('./views/MyMatches.vue') },
  ],
});

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');
