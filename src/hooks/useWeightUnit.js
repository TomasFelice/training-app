import { useSettingsStore } from '../store'

const KG_TO_LB = 2.20462

export function useWeightUnit() {
  const { weightUnit } = useSettingsStore()

  // Always store in kg, display in selected unit
  function display(kg) {
    if (kg == null) return null
    return weightUnit === 'lb'
      ? Math.round(kg * KG_TO_LB * 4) / 4  // round to nearest 0.25 lb
      : kg
  }

  // Convert user input back to kg for storage
  function toKg(value) {
    if (value == null || value === '') return null
    const n = Number(value)
    return weightUnit === 'lb' ? Math.round((n / KG_TO_LB) * 100) / 100 : n
  }

  function label(kg) {
    const v = display(kg)
    if (v == null) return '—'
    return `${v}${weightUnit}`
  }

  return { unit: weightUnit, display, toKg, label }
}
