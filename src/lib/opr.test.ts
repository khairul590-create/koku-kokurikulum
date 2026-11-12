// Jalankan: node --test src/lib/opr.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatTarikh, toItems, wrapText } from './opr.ts'

test('formatTarikh: ISO → tarikh Melayu', () => {
  assert.equal(formatTarikh('2026-08-21'), '21 Ogos 2026')
  assert.equal(formatTarikh('2026-03-05'), '5 Mac 2026')
  assert.equal(formatTarikh(''), '')
})

test('toItems: satu baris satu item, buang nombor/bullet sedia ada', () => {
  assert.deepEqual(
    toItems('1. Murid membaca Yaasin\n\n2) Bacaan surah\n- Doa\n• Jamuan\n  '),
    ['Murid membaca Yaasin', 'Bacaan surah', 'Doa', 'Jamuan'],
  )
  assert.deepEqual(toItems(''), [])
})

test('wrapText: balut ikut lebar, perkataan panjang kekal sebaris', () => {
  const measure = (s: string) => s.length // 1 unit per aksara
  assert.deepEqual(wrapText('aa bb cc dd', 5, measure), ['aa bb', 'cc dd'])
  assert.deepEqual(wrapText('panjangsangat x', 5, measure), ['panjangsangat', 'x'])
  assert.deepEqual(wrapText('', 5, measure), [])
})
