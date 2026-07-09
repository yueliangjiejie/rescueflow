import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import * as ElIcons from '@element-plus/icons-vue';
import App from './App.vue';
import './assets/main.css';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/dashboard', name: 'dashboard', component: () => import('./views/Dashboard.vue') },
    { path: '/intake', name: 'intake', component: () => import('./views/Intake.vue') },
    { path: '/match', name: 'match', component: () => import('./views/MatchBoard.vue') },
    { path: '/helps', name: 'helps', component: () => import('./views/HelpList.vue') },
    { path: '/helps/:code', name: 'helpDetail', component: () => import('./views/HelpDetail.vue'), props: true },
    { path: '/map', name: 'map', component: () => import('./views/SituationMap.vue') },
    { path: '/shelter', name: 'shelter', component: () => import('./views/Shelter.vue') },
    { path: '/manage', name: 'manage', component: () => import('./views/Manage.vue') },
    { path: '/more', name: 'more', component: () => import('./views/More.vue') },
  ],
});

const app = createApp(App);
for (const [k, v] of Object.entries(ElIcons)) app.component(k, v);
app.use(ElementPlus);
app.use(router);
app.mount('#app');
