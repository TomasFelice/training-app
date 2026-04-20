import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, Send, ChevronRight,
  CheckCircle, AlertCircle, Dumbbell, RotateCcw, X,
} from 'lucide-react'
import { sendMessage, parseRoutineFromResponse, saveRoutineFromAI, hasApiKey } from '../lib/gemini'

const SUGGESTIONS = [
  { label: '💪 Generá una rutina', text: 'Tengo 3 días a la semana disponibles. Quiero priorizar hipertrofia en espalda y pecho. Haceme una rutina completa.' },
  { label: '📊 Analizá mi progreso', text: '¿Cómo viene mi progreso general? ¿Qué ejercicios están estancados?' },
  { label: '🔄 Romper estancamiento', text: '¿Qué puedo hacer para seguir progresando si estoy estancado en algún ejercicio?' },
  { label: '🦵 Rutina de piernas', text: 'Quiero una rutina de piernas de 4 ejercicios enfocada en hipertrofia. Generame el JSON.' },
]

// ── No API key configured screen ──────────────────────────────────────────

function NoKeyScreen() {
  return (
    <div className="flex flex-col h-full bg-black">
      <div style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 16px)' }} />
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
        <div className="w-20 h-20 bg-[#FF453A]/10 rounded-3xl flex items-center justify-center">
          <Sparkles size={36} className="text-[#FF453A]" />
        </div>
        <div className="text-center">
          <h1 className="text-white font-bold text-xl mb-2">API Key no configurada</h1>
          <p className="text-[#8E8E93] text-sm leading-relaxed">
            Agregá tu clave de Gemini en el archivo <code className="text-white bg-[#2C2C2E] px-1.5 py-0.5 rounded-md text-xs">.env</code> del proyecto:
          </p>
        </div>
        <div className="w-full bg-[#1C1C1E] rounded-2xl px-4 py-4">
          <p className="text-[#30D158] font-mono text-sm">VITE_GEMINI_API_KEY=AIza...</p>
        </div>
        <p className="text-[#48484A] text-xs text-center">
          Reiniciá el servidor de desarrollo después de guardar el archivo.
        </p>
      </div>
    </div>
  )
}

// ── Message Bubble ─────────────────────────────────────────────────────────

function MessageBubble({ msg, onSaveRoutine }) {
  const isUser = msg.role === 'user'
  const routine = !isUser ? parseRoutineFromResponse(msg.content) : null

  const displayText = msg.content
    .replace(/<ROUTINE_JSON>[\s\S]*?<\/ROUTINE_JSON>/g, '')
    .trim()

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}
    >
      {!isUser && (
        <div className="w-7 h-7 bg-[#BF5AF2]/20 rounded-full flex items-center justify-center mr-2 mt-1 flex-shrink-0">
          <Sparkles size={13} className="text-[#BF5AF2]" />
        </div>
      )}
      <div className="max-w-[82%] flex flex-col gap-2">
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-[#0A84FF] text-white rounded-br-md'
            : 'bg-[#1C1C1E] text-white/90 rounded-bl-md'
        }`}>
          {displayText || (msg.loading ? '' : '…')}
          {msg.loading && (
            <span className="inline-flex gap-1 ml-1">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                  className="w-1 h-1 bg-white/60 rounded-full inline-block"
                />
              ))}
            </span>
          )}
        </div>

        {routine && (
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#30D158]/10 border border-[#30D158]/30 rounded-2xl p-3"
          >
            <div className="flex items-start gap-2 mb-2">
              <Dumbbell size={14} className="text-[#30D158] mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-white text-xs font-semibold">{routine.name}</p>
                <p className="text-[#8E8E93] text-[11px]">
                  {routine.exercises?.length ?? 0} ejercicios · {routine.days?.join(', ')}
                </p>
              </div>
            </div>
            <button
              onClick={() => onSaveRoutine(routine)}
              className="pressable w-full bg-[#30D158] py-2.5 rounded-xl text-white text-xs font-semibold flex items-center justify-center gap-1.5"
            >
              <CheckCircle size={13} /> Guardar rutina
            </button>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}

// ── Main AI Page ───────────────────────────────────────────────────────────

export default function AIPage() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [savedRoutine, setSavedRoutine] = useState(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (!hasApiKey()) return <NoKeyScreen />

  async function handleSend(text) {
    const content = (text ?? input).trim()
    if (!content || loading) return
    setInput('')
    setError(null)

    const userMsg = { role: 'user', content }
    const loadingMsg = { role: 'assistant', content: '', loading: true }
    setMessages((prev) => [...prev, userMsg, loadingMsg])
    setLoading(true)

    try {
      const reply = await sendMessage([...messages, userMsg])
      setMessages((prev) => [...prev.slice(0, -1), { role: 'assistant', content: reply }])
    } catch (err) {
      setMessages((prev) => prev.slice(0, -1))
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveRoutine(parsed) {
    try {
      await saveRoutineFromAI(parsed)
      setSavedRoutine(parsed.name)
      setTimeout(() => setSavedRoutine(null), 3000)
    } catch {
      setError('No se pudo guardar la rutina.')
    }
  }

  return (
    <div className="flex flex-col h-full bg-black">
      <div style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 16px)' }} />

      {/* Header */}
      <div className="px-5 pb-3 flex-shrink-0">
        <h1 className="text-white text-2xl font-bold tracking-tight">IA Coach</h1>
        <p className="text-[#8E8E93] text-xs mt-0.5">Powered by Gemini</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scroll-ios px-4 py-2">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center gap-5 pt-6 pb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-[#BF5AF2]/30 to-[#0A84FF]/20 rounded-2xl flex items-center justify-center">
              <Sparkles size={28} className="text-[#BF5AF2]" />
            </div>
            <div className="text-center">
              <p className="text-white font-semibold text-base">¿En qué te ayudo hoy?</p>
              <p className="text-[#8E8E93] text-sm mt-1">
                Analizá tu progreso, generá rutinas o pedí consejos.
              </p>
            </div>
            <div className="w-full flex flex-col gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.label}
                  onClick={() => handleSend(s.text)}
                  className="pressable bg-[#1C1C1E] rounded-2xl px-4 py-3.5 flex items-center justify-between text-left"
                >
                  <span className="text-white text-sm">{s.label}</span>
                  <ChevronRight size={14} className="text-[#48484A] flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-2">
            {messages.map((msg, i) => (
              <MessageBubble key={i} msg={msg} onSaveRoutine={handleSaveRoutine} />
            ))}
          </div>
        )}

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex items-center gap-2 bg-[#FF453A]/15 border border-[#FF453A]/30 rounded-2xl px-4 py-3 mb-3"
            >
              <AlertCircle size={15} className="text-[#FF453A] flex-shrink-0" />
              <p className="text-[#FF453A] text-xs flex-1">{error}</p>
              <button onClick={() => setError(null)} className="pressable">
                <X size={14} className="text-[#FF453A]" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>

      {/* Saved routine toast */}
      <AnimatePresence>
        {savedRoutine && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-28 inset-x-5 z-50 bg-[#30D158] rounded-2xl px-4 py-3 flex items-center gap-2 shadow-xl"
          >
            <CheckCircle size={16} className="text-white flex-shrink-0" />
            <p className="text-white text-sm font-medium">"{savedRoutine}" guardada en Rutinas</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input bar */}
      <div
        className="glass border-t border-white/8 flex-shrink-0 px-4 py-3"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
      >
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="pressable flex items-center gap-1 text-[#48484A] text-xs mb-2"
          >
            <RotateCcw size={11} /> Nueva conversación
          </button>
        )}
        <div className="flex items-end gap-3">
          <div className="flex-1 bg-[#1C1C1E] rounded-2xl px-4 py-3 min-h-[44px] max-h-32">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
              }}
              placeholder="Preguntá algo…"
              rows={1}
              className="w-full bg-transparent text-white text-sm outline-none resize-none placeholder:text-[#48484A] leading-relaxed"
              style={{ maxHeight: '96px' }}
            />
          </div>
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className="pressable w-11 h-11 bg-[#0A84FF] rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-30 disabled:bg-[#2C2C2E]"
          >
            {loading
              ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                  <Sparkles size={17} className="text-white" />
                </motion.div>
              : <Send size={17} className="text-white" />
            }
          </button>
        </div>
      </div>
    </div>
  )
}
