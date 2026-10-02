import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(cleanup)
Object.defineProperty(window, 'matchMedia', { writable: true, value: (query) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }) })
