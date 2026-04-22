import { useState } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'

const RPE_DATA = [
  { value: 1,  label: '1',  desc: 'Muy fácil',         color: '#30D158' },
  { value: 2,  label: '2',  desc: 'Fácil',             color: '#30D158' },
  { value: 3,  label: '3',  desc: 'Moderado',          color: '#34C759' },
  { value: 4,  label: '4',  desc: 'Algo duro',         color: '#A3E635' },
  { value: 5,  label: '5',  desc: 'Duro',              color: '#FFD60A' },
  { value: 6,  label: '6',  desc: 'Duro+',             color: '#FF9F0A' },
  { value: 7,  label: '7',  desc: 'Muy duro',          color: '#FF6B00' },
  { value: 8,  label: '8',  desc: '2-3 reps en reserva', color: '#FF453A' },
  { value: 9,  label: '9',  desc: '1 rep en reserva',  color: '#FF375F' },
  { value: 10, label: '10', desc: 'Esfuerzo máximo',   color: '#BF5AF2' },
]

export default function RPESelector({ current, onSelect, onSkip }) {
  const [hovered, setHovered] = useState(current ?? null)

  const active = RPE_DATA.find((r) => r.value === hovered)

  return (
    <motion.div
      initial={{ y: '100%', opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: '100%', opacity: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 38 }}
      className="fixed inset-x-0 bottom-0 z-[61] bg-[#1C1C1E] rounded-t-3xl px-5 pt-4"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
    >
      {/* Handle */}
      <div className="flex justify-center mb-4">
        <div className="w-10 h-1 bg-[#48484A] rounded-full" />
      </div>

      <div className="flex items-center justify-between mb-1">
        <h3 className="text-white font-semibold text-lg">¿Cómo te sentiste?</h3>
        <button onClick={onSkip} className="pressable text-[#8E8E93]">
          <X size={20} />
        </button>
      </div>

      <p className="text-[#8E8E93] text-sm mb-5">
        RPE — Esfuerzo Percibido
      </p>

      {/* Active label */}
      <div className="h-12 flex items-center justify-center mb-4">
        {active ? (
          <motion.div
            key={active.value}
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center"
          >
            <span className="text-2xl font-bold" style={{ color: active.color }}>
              RPE {active.value}
            </span>
            <span className="text-[#8E8E93] text-sm ml-3">{active.desc}</span>
          </motion.div>
        ) : (
          <p className="text-[#48484A] text-sm">Tocá un valor</p>
        )}
      </div>

      {/* Scale buttons */}
      <div className="flex gap-1.5 mb-5">
        {RPE_DATA.map((r) => (
          <button
            key={r.value}
            onPointerEnter={() => setHovered(r.value)}
            onPointerLeave={() => setHovered(current ?? null)}
            onClick={() => onSelect(r.value)}
            className="pressable flex-1 flex flex-col items-center gap-1.5 py-2"
          >
            <motion.div
              animate={{
                scale: hovered === r.value ? 1.2 : 1,
                opacity: hovered === r.value ? 1 : 0.55,
              }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="w-7 h-7 rounded-full"
              style={{ backgroundColor: r.color }}
            />
            <span className="text-[10px] text-[#8E8E93] font-medium">{r.label}</span>
          </button>
        ))}
      </div>

      <button onClick={onSkip} className="pressable w-full py-3 text-[#8E8E93] text-sm">
        Omitir
      </button>
    </motion.div>
  )
}
