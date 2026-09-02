import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import '@/theme/tokens.css'
import '@/theme/fonts.css'
import '@/theme/base.css'

const app = createApp(App)
app.use(createPinia())
app.mount('#app')
