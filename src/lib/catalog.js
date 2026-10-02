export const TARGET_LABELS = {
  abs: 'Core', quads: 'Cuádriceps', lats: 'Espalda', calves: 'Pantorrillas', pectorals: 'Pecho',
  glutes: 'Glúteos', hamstrings: 'Isquiotibiales', adductors: 'Aductores', triceps: 'Tríceps',
  'cardiovascular system': 'Cardio', spine: 'Espalda', 'upper back': 'Espalda', biceps: 'Bíceps',
  delts: 'Hombros', forearms: 'Antebrazos', traps: 'Trapecios', 'serratus anterior': 'Serrato',
  'levator scapulae': 'Cuello', 'hip flexors': 'Flexores de cadera', abductors: 'Abductores',
  'lower back': 'Zona lumbar', shoulders: 'Hombros', chest: 'Pecho', quadriceps: 'Cuádriceps',
  obliques: 'Oblicuos', rhomboids: 'Romboides', 'ankle stabilizers': 'Estabilizadores de tobillo',
  core: 'Core', back: 'Espalda', 'rear deltoids': 'Deltoides posteriores', trapezius: 'Trapecios',
  ankles: 'Tobillos', feet: 'Pies', deltoids: 'Deltoides', brachialis: 'Braquial', groin: 'Ingle',
  wrists: 'Muñecas', 'rotator cuff': 'Manguito rotador', 'upper chest': 'Pecho superior',
  'latissimus dorsi': 'Dorsal ancho', 'wrist flexors': 'Flexores de muñeca', 'wrist extensors': 'Extensores de muñeca',
  abdominals: 'Abdominales', 'grip muscles': 'Músculos de agarre', 'lower abs': 'Abdominales inferiores',
  'inner thighs': 'Cara interna del muslo', soleus: 'Sóleo', sternocleidomastoid: 'Esternocleidomastoideo',
  hands: 'Manos', shins: 'Tibiales',
}
export const EQUIPMENT_LABELS = {
  'body weight': 'Peso corporal', dumbbell: 'Mancuernas', barbell: 'Barra', cable: 'Polea',
  'leverage machine': 'Máquina', band: 'Banda', 'smith machine': 'Multipower', kettlebell: 'Kettlebell',
  weighted: 'Con lastre', 'stability ball': 'Pelota de estabilidad', 'ez barbell': 'Barra EZ',
  'medicine ball': 'Pelota medicinal', 'bosu ball': 'Bosu', 'trap bar': 'Barra hexagonal',
  roller: 'Rodillo', rope: 'Cuerda', 'skierg machine': 'SkiErg', 'elliptical machine': 'Elíptica',
  'stationary bike': 'Bicicleta fija', 'stepmill machine': 'Escaladora', tire: 'Neumático',
  'wheel roller': 'Rueda abdominal', 'upper body ergometer': 'Ergómetro de brazos',
  assisted: 'Asistido', 'sled machine': 'Prensa', 'olympic barbell': 'Barra olímpica',
  'resistance band': 'Banda de resistencia', hammer: 'Martillo',
}
export const muscleLabel = (target) => TARGET_LABELS[target] ?? target
export const equipmentLabel = (equipment) => EQUIPMENT_LABELS[equipment] ?? equipment
export const MUSCLE_GROUPS = ['Pecho', 'Espalda', 'Hombros', 'Bíceps', 'Tríceps', 'Cuádriceps', 'Isquiotibiales', 'Glúteos', 'Core', 'Pantorrillas', 'Antebrazos', 'Trapecios', 'Aductores', 'Abductores', 'Cuello', 'Cardio']
export const normalizeSearch = (value = '') => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
export function filterExercises(exercises = [], { query = '', muscleGroup = '', equipment = '', archived = false } = {}) {
  const words = normalizeSearch(query).split(/\s+/).filter(Boolean)
  return exercises.filter((exercise) => {
    if (Boolean(exercise.archived) !== archived) return false
    if (muscleGroup && exercise.muscleGroup !== muscleGroup) return false
    if (equipment && exercise.equipment !== equipment) return false
    const haystack = normalizeSearch([exercise.name, exercise.catalogName, ...(exercise.aliases ?? []),
      exercise.muscleGroup, muscleLabel(exercise.target), equipmentLabel(exercise.equipment)].filter(Boolean).join(' '))
    return words.every((word) => haystack.includes(word))
  })
}

// Reviewed correspondences for the original seed. Uncertain movements (Face Pull,
// Hip Thrust, plain Plank) remain local rather than acquiring incorrect instructions.
export const LEGACY_CATALOG_IDS = {
  'Press Banca': '0025', 'Press Banca Inclinado': '0047', 'Press Banca Declinado': '0033',
  'Aperturas con Mancuernas': '0308', 'Press con Mancuernas': '0289', 'Fondos en Paralelas': '0251',
  'Crossover en Polea': '0155', 'Dominadas': '0652', 'Remo con Barra': '0027',
  'Remo con Mancuerna': '0292',
  'Jalón al Pecho': '2330', 'Peso Muerto': '0032', 'Peso Muerto Rumano': '0085',
  'Pullover con Mancuerna': '0375', 'Press Arnold': '2137', 'Elevaciones Laterales': '0334',
  'Press Militar': '1457',
  'Elevaciones Frontales': '0310', 'Pájaros': '0380', 'Curl con Barra': '0031',
  'Curl con Mancuernas': '0294', 'Curl Martillo': '0313', 'Curl en Predicador': '0070',
  'Curl en Polea': '0868', 'Extensión Francesa': '0060', 'Patada de Tríceps': '0333',
  'Press Cerrado': '0030', 'Extensión en Polea Alta': '0201', 'Fondos entre Bancos': '0129',
  'Sentadilla': '0043', 'Sentadilla Frontal': '0042', 'Prensa de Piernas': '0739',
  'Extensión de Cuádriceps': '0585', 'Zancadas': '0336', 'Curl Femoral': '0599',
  'Buenos Días': '0044', 'Elevación de Pantorrillas': '1373', 'Crunch en Polea': '0175',
  'Rueda Abdominal': '0857',
}
export const aliasesFor = (catalogId) => Object.entries(LEGACY_CATALOG_IDS)
  .filter(([, id]) => id === catalogId).map(([name]) => name)
