import { useState, useRef } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform, useAnimation } from 'framer-motion'
import { Check, Trash2 } from 'lucide-react'
import { useWeightUnit } from '../hooks/useWeightUnit'

const SWIPE_THRESHOLD = -72

export default function SetRow({ index, set, prevSet, onUpdate, onRemove, onDone }) {
  const { unit, display, toKg } = useWeightUnit()

  // Display values in selected unit; internal storage always kg
  const [weightDisplay, setWeightDisplay] = useState(
    set.weight != null ? String(display(set.weight)) : ''
  )
  const [reps, setReps] = useState(set.reps != null ? String(set.reps) : '')
  const repsRef = useRef(null)

  const isDone = set.done

  // Swipe-to-delete
  const x = useMotionValue(0)
  const deleteOpacity = useTransform(x, [-90, -40], [1, 0])
  const rowOpacity    = useTransform(x, [-90, 0],  [0.6, 1])
  const controls      = useAnimation()

  async function handleDragEnd(_, info) {
    if (info.offset.x < SWIPE_THRESHOLD) {
      await controls.start({ x: -80, transition: { type: 'spring', stiffness: 500, damping: 40 } })
      // brief pause so user sees the delete zone, then remove
      await new Promise((r) => setTimeout(r, 120))
      await controls.start({ x: -400, opacity: 0, transition: { duration: 0.22 } })
      onRemove()
    } else {
      controls.start({ x: 0, transition: { type: 'spring', stiffness: 500, damping: 40 } })
    }
  }

  function commit() {
    onUpdate({
      weight: weightDisplay === '' ? null : toKg(weightDisplay),
      reps:   reps === '' ? null : Number(reps),
    })
  }

  function handleDone() {
    commit()
    onDone({
      weight: toKg(weightDisplay) ?? 0,
      reps:   Number(reps) || 0,
    })
  }

  const prevWeight = prevSet?.weight != null ? display(prevSet.weight) : null
  const prevReps   = prevSet?.reps

  return (
    <div className="relative overflow-hidden">
      {/* Delete background */}
      <motion.div
        style={{ opacity: deleteOpacity }}
        className="absolute inset-y-0 right-0 w-20 flex items-center justify-center bg-[#FF453A]/20"
      >
        <Trash2 size={18} className="text-[#FF453A]" />
      </motion.div>

      {/* Swipeable row */}
      <motion.div
        drag={isDone ? false : 'x'}
        dragConstraints={{ left: -80, right: 0 }}
        dragElastic={{ left: 0.15, right: 0.05 }}
        onDragEnd={handleDragEnd}
        animate={controls}
        style={{ x, opacity: rowOpacity }}
        className={`relative flex items-center gap-3 px-4 py-2.5 bg-black transition-colors ${
          isDone ? 'opacity-55' : ''
        }`}
      >
        {/* Set number */}
        <span className="w-6 text-[#8E8E93] text-sm font-medium text-center flex-shrink-0">
          {index + 1}
        </span>

        {/* Previous hint */}
        <div className="w-16 flex-shrink-0 text-center">
          {prevWeight != null ? (
            <span className="text-[#48484A] text-xs tabular-nums">
              {prevWeight}×{prevReps}
            </span>
          ) : (
            <span className="text-[#3A3A3C] text-xs">—</span>
          )}
        </div>

        {/* Weight */}
        <div className="flex-1">
          <div className={`flex items-center gap-1 bg-[#2C2C2E] rounded-xl px-3 py-2 ${isDone ? 'opacity-60' : ''}`}>
            <input
              type="number"
              inputMode="decimal"
              value={weightDisplay}
              onChange={(e) => setWeightDisplay(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => { if (e.key === 'Enter') repsRef.current?.focus() }}
              placeholder={prevWeight != null ? String(prevWeight) : '0'}
              disabled={isDone}
              className="w-full bg-transparent text-white text-sm font-medium text-center outline-none tabular-nums placeholder:text-[#3A3A3C]"
            />
            <span className="text-[#48484A] text-xs flex-shrink-0">{unit}</span>
          </div>
        </div>

        {/* Reps */}
        <div className="flex-1">
          <div className={`flex items-center gap-1 bg-[#2C2C2E] rounded-xl px-3 py-2 ${isDone ? 'opacity-60' : ''}`}>
            <input
              ref={repsRef}
              type="number"
              inputMode="numeric"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              onBlur={commit}
              placeholder={prevReps != null ? String(prevReps) : '0'}
              disabled={isDone}
              className="w-full bg-transparent text-white text-sm font-medium text-center outline-none tabular-nums placeholder:text-[#3A3A3C]"
            />
            <span className="text-[#48484A] text-xs flex-shrink-0">rep</span>
          </div>
        </div>

        {/* Done button */}
        <AnimatePresence mode="wait">
          {isDone ? (
            <motion.div
              key="done"
              initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
              className="w-9 h-9 bg-[#30D158]/20 rounded-full flex items-center justify-center flex-shrink-0"
            >
              <Check size={16} className="text-[#30D158]" strokeWidth={2.5} />
            </motion.div>
          ) : (
            <motion.button
              key="check"
              initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
              onClick={handleDone}
              disabled={!weightDisplay && !reps}
              className="pressable w-9 h-9 bg-[#2C2C2E] rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-30"
            >
              <Check size={16} className="text-[#8E8E93]" strokeWidth={2.5} />
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
