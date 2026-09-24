import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'
import { isAuthenticated } from './services/auth'
import './style.css'
import './theme.css'
const router = createRouter({ history: createWebHashHistory(), routes: ['/', '/login', '/home', '/chat', '/agents', '/library', '/history', '/bookmarks', '/settings'].map(path => ({ path, component: { template: '<span />' } })) })
router.beforeEach(to => {
 if (to.path === '/login') return isAuthenticated.value ? '/home' : true
 if (!isAuthenticated.value) return '/login'
 if (to.path === '/') return '/home'
 return true
})
createApp(App).use(router).mount('#app')
