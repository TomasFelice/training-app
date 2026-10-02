import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import Sheet from './Sheet'

function isInstalled() { return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true }
export default function InstallPrompt({ compact = false }) {
  const [prompt, setPrompt] = useState(null)
  const [installed, setInstalled] = useState(isInstalled)
  const [dismissed, setDismissed] = useState(() => { try { return localStorage.getItem('gymtrack_install_dismissed') === 'true' } catch { return false } })
  const [instructions, setInstructions] = useState(false)
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  useEffect(() => {
    const beforeInstall = (event) => { event.preventDefault(); setPrompt(event) }
    const installedEvent = () => { setInstalled(true); setPrompt(null); setInstructions(false) }
    const standalone = window.matchMedia('(display-mode: standalone)')
    const displayChange = () => setInstalled(isInstalled())
    window.addEventListener('beforeinstallprompt', beforeInstall); window.addEventListener('appinstalled', installedEvent)
    standalone.addEventListener('change', displayChange)
    return () => { window.removeEventListener('beforeinstallprompt', beforeInstall); window.removeEventListener('appinstalled', installedEvent); standalone.removeEventListener('change', displayChange) }
  }, [])
  async function install() {
    if (!prompt) { setInstructions(true); return }
    await prompt.prompt()
    const choice = await prompt.userChoice
    setPrompt(null)
    if (choice.outcome === 'accepted') setDismissed(true)
  }
  function dismiss() { setDismissed(true); try { localStorage.setItem('gymtrack_install_dismissed', 'true') } catch { /* Optional preference. */ } }
  if (installed || (!compact && dismissed)) return null
  return <><div className={`install-prompt ${compact ? 'compact' : ''}`}><Download size={21} /><div><strong>GymTrack en tu inicio</strong>{!compact && <p>Abrí tus entrenamientos como una app.</p>}<button className="text-button" onClick={install}>Agregar a inicio</button></div>{!compact && <button className="icon-button" aria-label="Ocultar sugerencia de instalación" onClick={dismiss}><X size={18} /></button>}</div>
    {instructions && <Sheet title="Agregar GymTrack a inicio" onClose={() => setInstructions(false)}>
      {ios ? <ol className="instruction-list"><li>Abrí esta página en Safari.</li><li>Tocá Compartir y elegí “Agregar a pantalla de inicio”.</li><li>Confirmá con “Agregar”.</li></ol> : <ol className="instruction-list"><li>Abrí el menú de tu navegador.</li><li>Elegí “Instalar app” o “Agregar a pantalla de inicio”, si está disponible.</li><li>Confirmá la instalación.</li></ol>}
    </Sheet>}
  </>
}
