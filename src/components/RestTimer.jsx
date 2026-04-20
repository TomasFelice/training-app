import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Minus } from 'lucide-react'
import { useWorkoutStore } from '../store'

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function RestTimer() {
  const { restTimer, tickRestTimer, stopRestTimer, setRestTarget } = useWorkoutStore()
  const intervalRef = useRef(null)

  useEffect(() => {
    if (restTimer.running) {
      intervalRef.current = setInterval(tickRestTimer, 1000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [restTimer.running, tickRestTimer])

  const progress = Math.min(restTimer.seconds / restTimer.target, 1)
  const remaining = Math.max(restTimer.target - restTimer.seconds, 0)
  const finished = remaining === 0 && restTimer.running === false && restTimer.seconds > 0

  // Circumference of the progress ring
  const r = 28
  const circ = 2 * Math.PI * r
  const dash = circ * (1 - progress)

  return (
    <AnimatePresence>
      {(restTimer.running || finished) && (
        <motion.div
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 38 }}
          className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+72px)] inset-x-4 z-40"
        >
          <div className="glass border border-white/10 rounded-3xl px-5 py-4 flex items-center gap-4 shadow-2xl">
            {/* Progress ring + countdown */}
            <div className="relative w-16 h-16 flex-shrink-0">
              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                <circle
                  cx="32" cy="32" r={r}
                  fill="none" stroke="#2C2C2E" strokeWidth="4"
                />
                <motion.circle
                  cx="32" cy="32" r={r}
                  fill="none"
                  stroke={finished ? '#30D158' : '#0A84FF'}
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={circ}
                  animate={{ strokeDashoffset: dash }}
                  transition={{ duration: 0.4, ease: 'linear' }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-sm font-bold tabular-nums ${finished ? 'text-[#30D158]' : 'text-white'}`}>
                  {finished ? '✓' : formatTime(remaining)}
                </span>
              </div>
            </div>

            {/* Label + controls */}
            <div className="flex-1">
              <p className="text-[#8E8E93] text-xs mb-1">Descanso</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setRestTarget(Math.max(15, restTimer.target - 15))}
                  className="pressable w-7 h-7 bg-[#2C2C2E] rounded-full flex items-center justify-center"
                >
                  <Minus size={13} className="text-white" />
                </button>
                <span className="text-white text-xs font-medium tabular-nums w-10 text-center">
                  {formatTime(restTimer.target)}
                </span>
                <button
                  onClick={() => setRestTarget(restTimer.target + 15)}
                  className="pressable w-7 h-7 bg-[#2C2C2E] rounded-full flex items-center justify-center"
                >
                  <Plus size={13} className="text-white" />
                </button>
              </div>
            </div>

            {/* Skip / close */}
            <button
              onClick={stopRestTimer}
              className="pressable w-10 h-10 bg-[#2C2C2E] rounded-full flex items-center justify-center flex-shrink-0"
            >
              <X size={16} className="text-[#8E8E93]" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
