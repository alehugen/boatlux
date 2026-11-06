import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { useThemeStore } from './presentation/composables/useTheme'
import './presentation/main.css'
import { router } from './presentation/router'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia).use(router)

useThemeStore(pinia)

/** Monta o app quando a primeira rota já está pronta e só então some com a tela de carregamento. */
void router.isReady().then(() => {
  app.mount('#app')
  const boot = document.getElementById('boot')
  if (!boot) return
  requestAnimationFrame(() => boot.classList.add('done'))
  boot.addEventListener('transitionend', () => boot.remove(), { once: true })
  setTimeout(() => boot.remove(), 1000)
})
