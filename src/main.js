import { createApp } from 'vue'
import './styles/tokens.css'
import './styles/reset.css'
import './styles/utilities.css'
import App from './App.vue'
import { pinia } from './stores'
import router from './router'

const app = createApp(App)
app.use(pinia)
app.use(router)
app.mount('#app')
