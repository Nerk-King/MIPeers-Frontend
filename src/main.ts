import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'
import './style.css'
const router = createRouter({ history: createWebHashHistory(), routes: ['/', '/chat', '/agents', '/library', '/history', '/bookmarks', '/settings'].map(path => ({ path, component: { template: '<span />' } })) })
createApp(App).use(router).mount('#app')
