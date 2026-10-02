# GymTrack

Registro de entrenamiento mobile con React 19, Vite, Zustand e IndexedDB (Dexie). Incluye catálogo de ejercicios, biblioteca de rutinas, sesiones recuperables, progreso y coach Gemini opcional.

## Desarrollo

```sh
npm ci
npm run dev
```

Los ejercicios y medios procesados están incluidos en `public/catalog`: el desarrollo y el build no dependen de descargar el repositorio de origen ni de ejecutar FFmpeg.

Para habilitar el coach, copiá `.env.example` a `.env` y configurá `VITE_GEMINI_API_KEY`. El modelo predeterminado es `gemini-3.8-flash`, con razonamiento medio, temperatura 1 y un límite de 32.768 tokens que incluye razonamiento y respuesta. `VITE_GEMINI_MODEL` permite configurar otro modelo compatible con Gemini 3. Las respuestas mantienen las firmas de razonamiento entre turnos y las instrucciones del coach se envían como instrucciones de sistema.

Gemini 3.8 Flash dispone de cuota gratuita de la API, sujeta a los límites del proyecto en [Google AI Studio](https://aistudio.google.com/usage). [Google AI Pro](https://support.google.com/googleone/answer/14534406) ofrece beneficios en los productos de Google; la [facturación de la API](https://ai.google.dev/gemini-api/docs/pricing) se gestiona por separado. Un proyecto con facturación habilitada paga por uso; elegir un modelo con cuota gratuita no fuerza que las llamadas sean gratis. Esta app no habilita facturación ni cambia de modelo automáticamente si se agota la cuota.

La app usa una integración directa con Gemini: la clave de `.env` es visible en el cliente. `.env.example` es una plantilla sin credenciales y `.env` está ignorado por Git. La interfaz de entrenamiento, rutinas y progreso funciona sin el coach. Después de cambiar `.env`, reiniciá el servidor de desarrollo; para una instalación publicada, generá un build nuevo.

## Qué incluye

- 1.324 ejercicios con nombres e instrucciones en español, miniaturas y MP4 de 180×180. Búsqueda por nombre en español o inglés, alias, grupo muscular y equipamiento.
- Plantillas Full body inicial, Torso/pierna, Push/pull/legs y Full body con mancuernas. Se copian al editor y se guardan como rutinas personales independientes.
- Edición de series y reps con borradores vacíos y validación de enteros positivos al confirmar.
- Sesiones persistidas localmente: orden de ejercicios, valores de las series, esfuerzo y tiempos. Minimizar conserva la sesión; descartar requiere confirmación.
- Guardado transaccional e idempotente. Un error de escritura conserva las series para reintentar; un reintento no duplica el historial.
- PWA instalable. Shell, fuentes y catálogo textual disponibles offline; miniaturas cacheadas bajo demanda. Los vídeos se descargan al abrir una demostración y no se incluyen en el precache.
- Actualizaciones de la PWA diferidas mientras exista un entrenamiento activo.

El tiempo de entrenamiento incluye el tiempo fuera de la pantalla o de la app. Se calcula mediante timestamps; no requiere ejecutar un intervalo mientras el sistema suspende el navegador. Los datos quedan en este dispositivo y origen web; no se sincronizan entre dispositivos.

## Catálogo reproducible

Origen: [hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset), revisión fija `7455efae41b330c265e7cd4b78dfa848e7ce5ebd`. Procedencia, checksum y licencias: `public/catalog/source.json`, `LICENSE` y `NOTICE.md`.

Los nombres en español están versionados por ID en `scripts/exercise-names.es.json`. La importación exige una traducción para cada ejercicio y conserva su nombre inglés en `originalName`; no usa traducción automática en tiempo de ejecución.

```sh
npm run catalog:import
npm run catalog:sample
npm run catalog:media
```

`catalog:import` valida y genera el JSON compacto y las miniaturas. `catalog:sample` convierte 12 ejercicios distribuidos por el catálogo. `catalog:media` convierte y valida los 1.324 GIF. Los originales se descargan a `.cache/exercises/<revision>`, ignorado por Git; sólo se publican los JPG y MP4 procesados. Los scripts usan descargas atómicas y reanudan salidas previamente verificadas de la misma revisión/configuración.

FFmpeg se obtiene de `ffmpeg-static`, fijado por el lockfile. Si tu entorno deshabilita scripts de instalación, ejecutá `node node_modules/ffmpeg-static/install.js`, o especificá un ejecutable:

```sh
npm run catalog:media -- --ffmpeg /ruta/a/ffmpeg --concurrency 4
```

También se admite `FFMPEG_PATH`. La conversión usa H.264, `yuv420p`, CRF 23, preset `slow`, `faststart`, sin audio, un único ciclo y timestamps de cada frame. Se verifica la resolución original, se decodifica completamente cada MP4 y se compara su duración con la suma de los delays del GIF (tolerancia de 20 ms). El proceso devuelve un código de error si algún archivo falla.

Resultado medido de la conversión completa:

| Medida | Resultado |
|---|---:|
| GIF originales | 128.741.397 bytes |
| MP4 publicados | 14.980.979 bytes |
| Reducción | 88,36 % |
| Archivos verificados | 1.324 |
| Errores | 0 |

Informes: [conversión completa](reports/media-conversion.json), [muestra](reports/media-sample.json) y manifiesto de medios en `public/catalog/media-manifest.json`.

El código/datos/instrucciones del catálogo están bajo MIT. Las imágenes y animaciones pertenecen a **Gym visual** y tienen licencia separada, confirmada por el propietario de este proyecto. Se conserva la atribución en fichas, miniaturas y ajustes. Clonar este proyecto no transfiere una licencia de esos medios: consultá `public/catalog/NOTICE.md`. Barlow y Barlow Condensed se distribuyen bajo SIL OFL; las licencias están en `public/licenses`.

## Datos existentes

La versión 3 de la base conserva las migraciones previas, IDs numéricos y referencias de rutinas/historial. Agrega identidad de catálogo e índices, y un identificador único para cada sesión guardada.

El enriquecimiento usa correspondencias explícitas en `src/lib/catalog.js`. La revisión `es-v1` traduce los nombres predeterminados del catálogo ya instalado y conserva los nombres personalizados, grupos, fotos y estado oculto existentes. Los nombres originales en inglés siguen disponibles para buscar. Los movimientos sin correspondencia segura permanecen personalizados. Ocultar siempre archiva el ejercicio para conservar referencias, incluso en un entrenamiento sin guardar; puede restaurarse desde “Ver ocultos”.

La inicialización del catálogo es transaccional e idempotente y se espera antes de mostrar la app. Si falla, la pantalla de inicio ofrece reintentar sin borrar datos.

## Validación

```sh
npm test
npm run lint
npm run build
```

Para los recorridos en navegador:

```sh
npx playwright install chromium
npm run preview -- --host 127.0.0.1
# En otra terminal:
npm run test:e2e
```

`APP_URL` permite usar otro servidor. El script crea contextos de prueba aislados, genera capturas en `test-results` y verifica tamaños mobile/desktop, edición, reproducción MP4, navegación, recarga, cierre/reapertura con datos persistidos, tiempos después de suspensión, fallo/reintento de guardado, instalación y uso offline. No envía consultas a Gemini ni modifica datos de un perfil de navegador personal.

Las pruebas de Vitest cubren migración desde v1 y desde el catálogo en inglés, catálogo completo en español, búsqueda bilingüe, importación repetida, conservación de fotos/ediciones, archivado, plantillas independientes, alias del coach, edición numérica, conservación del peso al cambiar unidades, persistencia y timers, transacciones/reintentos y actualización diferida de la PWA.

La revisión visual y funcional se realizó en Chromium con emulación mobile (360, 390, 430 px), desktop (1280 px), instrucciones iOS y viewport reducido para simular el teclado. WebKit no pudo iniciar en este host Windows por DLL faltantes; el script registra esa limitación. **La reproducción e instalación en Safari iOS y Chrome Android en dispositivos reales quedan pendientes de comprobación.**
