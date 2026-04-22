import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, Check, Plus } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'

const MUSCLE_GROUPS = [
  'Todos', 'Pecho', 'Espalda', 'Hombros', 'Bíceps',
  'Tríceps', 'Cuádriceps', 'Isquiotibiales', 'Glúteos', 'Core',
]

const MUSCLE_COLORS = {
  Pecho:          'bg-red-500/20 text-red-400',
  Espalda:        'bg-blue-500/20 text-blue-400',
  Hombros:        'bg-orange-500/20 text-orange-400',
  Bíceps:         'bg-purple-500/20 text-purple-400',
  Tríceps:        'bg-pink-500/20 text-pink-400',
  Cuádriceps:     'bg-green-500/20 text-green-400',
  Isquiotibiales: 'bg-teal-500/20 text-teal-400',
  Glúteos:        'bg-yellow-500/20 text-yellow-400',
  Core:           'bg-gray-500/20 text-gray-400',
  Pantorrillas:   'bg-indigo-500/20 text-indigo-400',
}

const MUSCLE_GROUPS_CREATE = [
  'Pecho', 'Espalda', 'Hombros', 'Bíceps',
  'Tríceps', 'Cuádriceps', 'Isquiotibiales', 'Glúteos', 'Core', 'Pantorrillas',
]

// ── Inline quick-create form ──────────────────────────────────────────────

function InlineCreateForm({ onCreated, onClose }) {
  const [name, setName] = useState('')
  const [muscleGroup, setMuscleGroup] = useState('')

  async function handleCreate() {
    if (!name.trim() || !muscleGroup) return
    const id = await db.exercises.add({ name: name.trim(), muscleGroup, photoBase64: null })
    onCreated(id)
  }

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden"
    >
      <div className="bg-[#2C2C2E] rounded-2xl mx-0 mb-3 p-3">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-white text-sm font-semibold flex-1">Nuevo ejercicio</h3>
          <button onClick={onClose} className="pressable">
            <X size={14} className="text-[#8E8E93]" />
          </button>
        </div>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre del ejercicio"
          className="w-full bg-[#3A3A3C] rounded-xl px-3 py-2 text-white text-sm outline-none placeholder:text-[#48484A] mb-3"
          autoFocus
        />

        <div className="flex flex-wrap gap-1.5 mb-3">
          {MUSCLE_GROUPS_CREATE.map((g) => (
            <button
              key={g}
              onClick={() => setMuscleGroup(g)}
              className={`pressable px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                muscleGroup === g ? 'bg-[#0A84FF] text-white' : 'bg-[#3A3A3C] text-[#8E8E93]'
              }`}
            >
              {g}
            </button>
          ))}
        </div>

        <button
          onClick={handleCreate}
          disabled={!name.trim() || !muscleGroup}
          className="pressable w-full bg-[#0A84FF] py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-30"
        >
          Crear y agregar
        </button>
      </div>
    </motion.div>
  )
}

// ── Main Picker ───────────────────────────────────────────────────────────

export default function ExercisePicker({ selectedIds = [], onConfirm, onClose }) {
  const [query, setQuery] = useState('')
  const [filterGroup, setFilterGroup] = useState('Todos')
  const [selected, setSelected] = useState(new Set(selectedIds))
  const [showCreate, setShowCreate] = useState(false)

  const exercises = useLiveQuery(() => db.exercises.orderBy('name').toArray(), [])

  const filtered = useMemo(() => {
    if (!exercises) return []
    return exercises.filter((e) => {
      const matchGroup = filterGroup === 'Todos' || e.muscleGroup === filterGroup
      const matchQuery = e.name.toLowerCase().includes(query.toLowerCase())
      return matchGroup && matchQuery
    })
  }, [exercises, query, filterGroup])

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleCreated(id) {
    setSelected((prev) => new Set([...prev, id]))
    setShowCreate(false)
    setQuery('')
  }

  // Show create hint when search has no results
  const noResults = filtered.length === 0 && query.length > 0

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 380, damping: 40 }}
      className="fixed inset-x-0 bottom-0 z-50 flex flex-col bg-[#1C1C1E] rounded-t-3xl"
      style={{ maxHeight: '90vh', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {/* Handle */}
      <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
        <div className="w-10 h-1 bg-[#48484A] rounded-full" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 flex-shrink-0">
        <button onClick={onClose} className="pressable text-[#0A84FF] text-base font-medium">
          Cancelar
        </button>
        <h2 className="text-white font-semibold text-base">Ejercicios</h2>
        <button
          onClick={() => onConfirm([...selected])}
          className="pressable text-[#0A84FF] text-base font-semibold"
        >
          Listo ({selected.size})
        </button>
      </div>

      {/* Search */}
      <div className="px-5 pb-3 flex gap-2 flex-shrink-0">
        <div className="flex-1 flex items-center gap-3 bg-[#2C2C2E] rounded-xl px-3 py-2.5">
          <Search size={16} className="text-[#8E8E93] flex-shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar ejercicio…"
            className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-[#48484A]"
            autoCapitalize="none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="pressable">
              <X size={14} className="text-[#8E8E93]" />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className={`pressable w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            showCreate ? 'bg-[#0A84FF]' : 'bg-[#2C2C2E]'
          }`}
          title="Crear ejercicio"
        >
          <Plus size={16} className={showCreate ? 'text-white' : 'text-[#8E8E93]'} />
        </button>
      </div>

      {/* Muscle group filter chips */}
      <div className="flex gap-2 px-5 pb-3 overflow-x-auto flex-shrink-0 scrollbar-hide">
        {MUSCLE_GROUPS.map((g) => (
          <button
            key={g}
            onClick={() => setFilterGroup(g)}
            className={`pressable flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filterGroup === g
                ? 'bg-[#0A84FF] text-white'
                : 'bg-[#2C2C2E] text-[#8E8E93]'
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {/* Exercise list */}
      <div className="flex-1 overflow-y-auto scroll-ios px-5 pb-4">
        {/* Inline create form */}
        <AnimatePresence>
          {showCreate && (
            <InlineCreateForm
              onCreated={handleCreated}
              onClose={() => setShowCreate(false)}
            />
          )}
        </AnimatePresence>

        <div className="flex flex-col gap-1">
          {filtered.map((ex) => {
            const isSelected = selected.has(ex.id)
            return (
              <button
                key={ex.id}
                onClick={() => toggle(ex.id)}
                className="pressable flex items-center gap-3 py-3 px-1"
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  isSelected ? 'bg-[#0A84FF] border-[#0A84FF]' : 'border-[#48484A]'
                }`}>
                  {isSelected && <Check size={11} className="text-white" strokeWidth={3} />}
                </div>
                <div className="flex-1 text-left">
                  <span className="text-white text-sm">{ex.name}</span>
                </div>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                  MUSCLE_COLORS[ex.muscleGroup] ?? 'bg-gray-500/20 text-gray-400'
                }`}>
                  {ex.muscleGroup}
                </span>
              </button>
            )
          })}
          {noResults && !showCreate && (
            <div className="flex flex-col items-center gap-3 py-8">
              <p className="text-[#8E8E93] text-sm">Sin resultados para "{query}"</p>
              <button
                onClick={() => setShowCreate(true)}
                className="pressable flex items-center gap-1.5 text-[#0A84FF] text-sm font-medium"
              >
                <Plus size={15} /> Crear "{query}"
              </button>
            </div>
          )}
          {filtered.length === 0 && !query && (
            <p className="text-[#8E8E93] text-sm text-center py-8">Sin resultados</p>
          )}
        </div>
      </div>
    </motion.div>
  )
}
