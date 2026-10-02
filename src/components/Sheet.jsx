import { useEffect, useRef, useId } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export default function Sheet({ title, children, onClose, footer, className = '' }) {
  const ref = useRef(null)
  const closeRef = useRef(onClose)
  const titleId = useId()
  useEffect(() => { closeRef.current = onClose }, [onClose])
  useEffect(() => {
    const previous = document.activeElement
    const element = ref.current
    element.focus()
    const handleKey = (event) => {
      if (event.key === 'Escape') { event.stopPropagation(); closeRef.current(); return }
      if (event.key !== 'Tab') return
      const items = [...element.querySelectorAll('button, input, select, textarea, summary, a[href], [tabindex="0"]')]
        .filter((item) => !item.disabled && item.getClientRects().length)
      if (!items.length) { event.preventDefault(); return }
      const first = items[0], last = items.at(-1)
      if (event.shiftKey && (document.activeElement === first || document.activeElement === element)) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === element)) { event.preventDefault(); first.focus() }
    }
    element.addEventListener('keydown', handleKey)
    return () => { element.removeEventListener('keydown', handleKey); previous?.focus() }
  }, [])
  return createPortal(
    <div className="modal-root" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className={`sheet ${className}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={ref}>
        <header className="sheet-header"><h2 id={titleId}>{title}</h2><button className="icon-button" aria-label="Cerrar" onClick={onClose}><X size={21} /></button></header>
        <div className="sheet-body">{children}</div>
        {footer && <footer className="sheet-footer">{footer}</footer>}
      </section>
    </div>, document.body)
}
