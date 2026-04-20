import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Clock, Trash2, AlertTriangle } from 'lucide-react'
import { useSettingsStore } from '../store'
import { db } from '../db'

const REST_PRESETS = [45, 60, 90, 120, 180]

function SectionLabel({ children }) {
  return (
    <p className="text-[#8E8E93] text-xs font-semibold uppercase tracking-wider px-1 mb-2 mt-5 first:mt-0">
      {children}
    </p>
  )
}

function SettingRow({ icon: Icon, label, sublabel, right, onPress, destructive }) {
  const content = (
    <div className={`flex items-center gap-3 bg-[#1C1C1E] rounded-2xl px-4 py-3.5 ${onPress ? 'pressable' : ''}`}>
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
        destructive ? 'bg-[#FF453A]/15' : 'bg-[#2C2C2E]'
      }`}>
        <Icon size={16} className={destructive ? 'text-[#FF453A]' : 'text-[#8E8E93]'} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${destructive ? 'text-[#FF453A]' : 'text-white'}`}>{label}</p>
        {sublabel && <p className="text-[#8E8E93] text-xs mt-0.5">{sublabel}</p>}
      </div>
      {right}
    </div>
  )
  return onPress ? <button onClick={onPress} className="w-full">{content}</button> : content
}

export default function SettingsSheet({ onClose }) {
  const { weightUnit, setWeightUnit, defaultRestSeconds, setDefaultRestSeconds } = useSettingsStore()

  const [showConfirmClear, setShowConfirmClear] = useState(false)

  async function handleClearAllData() {
    await db.workouts.clear()
    await db.workout_sets.clear()
    setShowConfirmClear(false)
  }

  return (
    <>
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 40 }}
        className="fixed inset-x-0 bottom-0 z-50 bg-[#1C1C1E] rounded-t-3xl flex flex-col"
        style={{ maxHeight: '88vh', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 flex-shrink-0">
          <div className="w-10 h-1 bg-[#48484A] rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0">
          <h2 className="text-white font-bold text-xl">Configuración</h2>
          <button onClick={onClose} className="pressable w-8 h-8 bg-[#2C2C2E] rounded-full flex items-center justify-center">
            <X size={15} className="text-[#8E8E93]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scroll-ios px-5 pb-8">

          {/* ── Unidad de peso ── */}
          <SectionLabel>Unidad de peso</SectionLabel>
          <div className="flex bg-[#2C2C2E] rounded-2xl p-1 gap-1">
            {['kg', 'lb'].map((u) => (
              <button
                key={u}
                onClick={() => setWeightUnit(u)}
                className={`pressable flex-1 py-3 rounded-xl text-sm font-semibold transition-colors ${
                  weightUnit === u
                    ? 'bg-[#3A3A3C] text-white shadow-sm'
                    : 'text-[#8E8E93]'
                }`}
              >
                {u === 'kg' ? '🏋️ Kilogramos (kg)' : '🦅 Libras (lb)'}
              </button>
            ))}
          </div>

          {/* ── Descanso por defecto ── */}
          <SectionLabel>Tiempo de descanso predeterminado</SectionLabel>
          <div className="flex gap-2">
            {REST_PRESETS.map((s) => {
              const label = s >= 60 ? `${s / 60}min` : `${s}s`
              return (
                <button
                  key={s}
                  onClick={() => setDefaultRestSeconds(s)}
                  className={`pressable flex-1 py-3 rounded-xl text-xs font-semibold transition-colors ${
                    defaultRestSeconds === s
                      ? 'bg-[#0A84FF] text-white'
                      : 'bg-[#2C2C2E] text-[#8E8E93]'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
          <p className="text-[#48484A] text-xs px-1 mt-2">
            El timer arranca automáticamente al completar cada serie.
          </p>

          {/* ── Datos ── */}
          <SectionLabel>Datos</SectionLabel>
          <SettingRow
            icon={Trash2}
            label="Borrar historial de entrenamientos"
            sublabel="Rutinas y ejercicios se conservan"
            destructive
            onPress={() => setShowConfirmClear(true)}
          />

          {/* ── App info ── */}
          <SectionLabel>Acerca de</SectionLabel>
          <div className="bg-[#1C1C1E] rounded-2xl px-4 py-4 flex flex-col gap-1">
            <p className="text-white text-sm font-medium">GymTrack</p>
            <p className="text-[#8E8E93] text-xs">Versión 1.0.0 · Datos 100% locales</p>
            <p className="text-[#8E8E93] text-xs mt-1">
              Toda tu información se almacena únicamente en este dispositivo.
              No se envía nada a ningún servidor externo (salvo las consultas a Gemini que vos iniciás).
            </p>
          </div>

        </div>
      </motion.div>

      {/* Confirm clear data dialog */}
      <AnimatePresence>
        {showConfirmClear && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/70 flex items-end justify-center pb-10 px-5"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#1C1C1E] rounded-3xl p-6 w-full max-w-sm"
            >
              <div className="flex justify-center mb-4">
                <div className="w-14 h-14 bg-[#FF453A]/15 rounded-full flex items-center justify-center">
                  <AlertTriangle size={26} className="text-[#FF453A]" />
                </div>
              </div>
              <h3 className="text-white font-bold text-lg text-center mb-1">¿Borrar historial?</h3>
              <p className="text-[#8E8E93] text-sm text-center mb-6">
                Se eliminarán todos los entrenamientos y series. Esta acción no se puede deshacer.
              </p>
              <button
                onClick={handleClearAllData}
                className="pressable w-full bg-[#FF453A] py-3.5 rounded-2xl text-white font-semibold mb-3"
              >
                Sí, borrar todo
              </button>
              <button
                onClick={() => setShowConfirmClear(false)}
                className="pressable w-full py-3 text-[#8E8E93] text-sm"
              >
                Cancelar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
