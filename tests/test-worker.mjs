import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { request as httpsRequest } from 'node:https'
import { setTimeout as delay } from 'node:timers/promises'
import { SignJWT } from 'jose'
import ts from 'typescript'

// Real workerd + SQLite D1; isolated local state, never a remote database.
const root = resolve(import.meta.dirname, '..')
const program = ts.createProgram([resolve(root, 'worker/index.ts')], {
  target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler, lib: ['lib.es2020.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
  strict: true, skipLibCheck: true, noEmit: true,
})
const diagnostics = ts.getPreEmitDiagnostics(program)
assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
  getCurrentDirectory: () => root, getCanonicalFileName: (f) => f, getNewLine: () => '\n',
}))
assert.ok(existsSync(resolve(root, 'worker/index.ts')), 'Worker entry point must exist')
const scratch = process.env.TMPDIR || tmpdir()
const temp = mkdtempSync(resolve(scratch, 'koku-worker-test-'))
const config = resolve(temp, 'wrangler.json')
const state = resolve(temp, 'state')
const port = 19000 + Math.floor(Math.random() * 10000)
let base = `http://127.0.0.1:${port}`
const password = randomUUID()
const secret = randomUUID() + randomUUID()
const wrangler = process.env.WRANGLER_BIN || 'wrangler'
writeFileSync(config, JSON.stringify({
  name: 'koku-local-integration', main: resolve(root, 'worker/index.ts'),
  compatibility_date: '2026-09-01',
  d1_databases: [{ binding: 'DB', database_name: 'koku-test', database_id: '00000000-0000-0000-0000-000000000001' }],
}))
writeFileSync(resolve(temp, '.dev.vars'), `ADMIN_PASSWORD=${password}\nJWT_SECRET=${secret}\n`, { mode: 0o600 })
const env = { ...process.env, WRANGLER_SEND_METRICS: 'false' }
let server
let logs = ''
function sql(command) {
  const result = spawnSync(wrangler, ['d1', 'execute', 'koku-test', '--local', '--config', config, '--persist-to', state, '--command', command], { cwd: root, env, encoding: 'utf8', timeout: 120000 })
  assert.equal(result.status, 0, 'Local D1 query must succeed')
}
async function localFetch(url, options) {
  if (url.startsWith('http:')) return fetch(url, options)
  // Only this disposable localhost workerd uses a self-signed certificate.
  return new Promise((resolveResponse, reject) => {
    const request = httpsRequest(url, { ...options, rejectUnauthorized: false }, (response) => {
      let text = ''
      response.setEncoding('utf8')
      response.on('data', (part) => { text += part })
      response.on('end', () => resolveResponse(new Response(text, { status: response.statusCode, headers: response.headers })))
    })
    request.on('error', reject)
    request.end(options.body)
  })
}
async function stopServer() {
  if (!server?.pid) return
  const exited = new Promise((r) => server.once('exit', r))
  try { process.kill(-server.pid, 'SIGTERM') } catch {}
  await Promise.race([exited, delay(5000)])
  try { process.kill(-server.pid, 'SIGKILL') } catch {}
  server = undefined
}
async function startServer(https = false) {
  base = `${https ? 'https' : 'http'}://127.0.0.1:${port}`
  server = spawn(wrangler, ['dev', '--local', '--config', config, '--persist-to', state, '--port', String(port), '--ip', '127.0.0.1', ...(https ? ['--local-protocol', 'https'] : [])], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true })
  server.stdout.on('data', (b) => { logs += b })
  server.stderr.on('data', (b) => { logs += b })
  for (let i = 0; i < 240; i++) {
    if (server.exitCode !== null) throw new Error('Local Wrangler exited before readiness')
    try { if ((await req('/health', { auth: false })).status === 200) return } catch {}
    await delay(250)
  }
  assert.fail('Local Wrangler must become ready')
}
let cookie = ''
async function req(path, { method = 'GET', body, auth = true, origin = base, ip = '192.0.2.1', headers = {} } = {}) {
  const response = await localFetch(base + '/api' + path, {
    method, headers: {
      ...(auth && cookie ? { cookie } : {}),
      ...(method !== 'GET' && origin !== null ? { Origin: origin } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      'cf-connecting-ip': ip, ...headers,
    }, body: body === undefined ? undefined : JSON.stringify(body),
  })
  assert.match(response.headers.get('cache-control') || '', /no-store/)
  return { status: response.status, data: await response.json(), response }
}
try {
  const migration = spawnSync(wrangler, ['d1', 'execute', 'koku-test', '--local', '--config', config, '--persist-to', state, '--file', resolve(root, 'migrations/0001_kokurikulum.sql')], { cwd: root, env, encoding: 'utf8', timeout: 120000 })
  assert.equal(migration.status, 0, 'SQLite migration must apply')
  await startServer()
  assert.equal((await req('', { auth: false })).status, 404)
  assert.deepEqual((await req('/auth/me')).data, { authed: false })
  for (const path of ['/students', '/classes', '/units', '/enrollments', '/attendance', '/pajsk-scores', '/achievements', '/activities', '/stats', '/settings', `/reports/student/${randomUUID()}`, `/reports/unit/${randomUUID()}`]) {
    assert.equal((await req(path, { auth: false })).status, 401, path)
  }
  assert.equal((await req('/auth/login', { method: 'POST', body: { password }, origin: null })).status, 403)
  assert.equal((await req('/auth/login', { method: 'POST', body: { password }, origin: 'https://cross-origin.invalid' })).status, 403)
  const login = await req('/auth/login', { method: 'POST', body: { password } })
  assert.equal(login.status, 200)
  cookie = login.response.headers.get('set-cookie').split(';')[0]
  assert.match(login.response.headers.get('set-cookie'), /HttpOnly/)
  assert.match(login.response.headers.get('set-cookie'), /SameSite=Strict/i)
  assert.deepEqual((await req('/auth/me')).data, { authed: true })
  const validCookie = cookie
  for (const claims of [
    { role: 'viewer', issuer: 'koku', audience: 'koku-admin' },
    { role: 'admin', issuer: 'foreign', audience: 'koku-admin' },
    { role: 'admin', issuer: 'koku', audience: 'foreign' },
  ]) {
    const token = await new SignJWT({ role: claims.role }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt()
      .setIssuer(claims.issuer).setAudience(claims.audience).setExpirationTime('2d').sign(new TextEncoder().encode(secret))
    cookie = `koku_session=${token}`
    assert.equal((await req('/students')).status, 401)
  }
  cookie = 'koku_session=invalid'
  assert.equal((await req('/students')).status, 401)
  cookie = validCookie
  const emptyStats = (await req('/stats')).data
  for (const key of ['totalStudents', 'totalUnits', 'totalAchievements', 'participationPct', 'avgPajsk', 'attendancePct']) assert.equal(emptyStats[key], 0)
  for (const key of ['unitAverages', 'topStudents', 'lowAttendance', 'recentActivities']) assert.deepEqual(emptyStats[key], [])
  assert.deepEqual((await req('/settings')).data, {})
  assert.equal((await req('/settings', { method: 'PUT', body: {} })).status, 400)
  sql("INSERT INTO settings(id,data) VALUES(1,'{\"school\":\"Integration-only\"}')")
  const create = async (path, body) => {
    const r = await req(path, { method: 'POST', body })
    assert.equal(r.status, 201, path)
    assert.match(r.data.id, /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i)
    return r.data
  }
  const cls = await create('/classes', { name: 'Integration class', tahun: '4', guru_kelas: 'Test only' })
  const unit = await create('/units', { name: 'Integration unit', kind: 'kelab' })
  assert.equal((await req('/units/' + unit.id.toUpperCase())).status, 200, 'uppercase UUID GET must find the existing record')
  const student = await create('/students', { name: 'Integration student', class_id: cls.id.toUpperCase(), jantina: 'L', tahun: 6 })
  assert.equal(student.class_id, cls.id)
  assert.equal(student.kelas, cls.name)
  assert.equal(student.tahun, 4)
  assert.deepEqual(Object.keys(student).sort(), ['id', 'name', 'class_id', 'kelas', 'tahun', 'jantina'].sort())
  assert.equal((await req('/units', { method: 'POST', body: { name: '', kind: 'invalid' } })).status, 400)
  for (const date of ['2026-02-30', '2026-99-99', 'not-a-date']) assert.equal((await req('/activities', { method: 'POST', body: { title: 'Bad date', date } })).status, 400)
  for (const [path, body] of [
    ['/classes', { name: 'Bad year', tahun: 7 }],
    ['/students', { name: 'Bad gender', jantina: 'X' }],
    ['/enrollments', { student_id: student.id, unit_id: unit.id, highest_level: 'unknown' }],
    ['/attendance', { student_id: student.id, unit_id: unit.id, week: 53, present: true }],
    ['/attendance', { student_id: student.id, unit_id: unit.id, week: 1, present: 1 }],
    ['/pajsk-scores', { student_id: student.id, unit_id: unit.id, m_kehadiran: 101 }],
    ['/achievements', { title: 'Bad level', level: 'unknown' }],
  ]) assert.equal((await req(path, { method: 'POST', body })).status, 400, path)
  const duplicateClass = await req('/classes', { method: 'POST', body: { name: cls.name, tahun: 4 } })
  assert.equal(duplicateClass.status, 400)
  assert.equal(duplicateClass.data.error, 'Rekod ini sudah wujud (pendua).')
  const invalidReference = await req('/students', { method: 'POST', body: { name: 'Invalid reference', class_id: randomUUID() } })
  assert.equal(invalidReference.status, 400)
  assert.equal(invalidReference.data.error, 'Rujukan tidak sah — rekod berkaitan tidak wujud atau telah dipadam.')
  const enrollment = await create('/enrollments', { student_id: student.id.toUpperCase(), unit_id: unit.id.toUpperCase(), highest_level: 'negeri' })
  assert.equal(enrollment.student.name, student.name)
  assert.deepEqual(Object.keys(enrollment.student).sort(), ['id', 'name', 'kelas', 'tahun', 'jantina'].sort())
  assert.equal(enrollment.unit.id, unit.id)
  assert.equal((await req('/enrollments', { method: 'POST', body: { student_id: student.id, unit_id: unit.id } })).status, 400)
  const score = await create('/pajsk-scores', { student_id: student.id.toUpperCase(), unit_id: unit.id.toUpperCase(), m_kehadiran: 40, m_jawatan: 10, m_penglibatan: 20, m_pencapaian: 10 })
  assert.equal(score.total, 80)
  assert.equal(score.grade, 'A')
  const changedScore = await req(`/pajsk-scores/${score.id}`, { method: 'PUT', body: { m_pencapaian: 5 } })
  assert.equal(changedScore.data.total, 75)
  assert.equal(changedScore.data.grade, 'B')
  assert.equal(changedScore.data.m_kehadiran, 40)
  await Promise.all([
    req(`/pajsk-scores/${score.id}`, { method: 'PUT', body: { m_jawatan: 8 } }),
    req(`/pajsk-scores/${score.id}`, { method: 'PUT', body: { m_penglibatan: 18 } }),
  ])
  assert.equal((await req(`/pajsk-scores/${score.id}`)).data.total, 71)
  const attendance = []
  for (let week = 1; week <= 3; week++) attendance.push(await create('/attendance', { student_id: student.id.toUpperCase(), unit_id: unit.id.toUpperCase(), week, present: week === 1, session: week === 1 ? 'CaseSensitive' : '2026' }))
  assert.equal(attendance[0].present, true)
  assert.equal(attendance[1].present, false)
  const achievement = await create('/achievements', { student_id: student.id.toUpperCase(), unit_id: unit.id.toUpperCase(), title: 'Integration award' })
  const activity = await create('/activities', { unit_id: unit.id.toUpperCase(), title: 'Integration activity', date: '2026-10-01' })
  const noDate = await create('/activities', { title: 'No date' })
  assert.equal(noDate.unit, null)
  // All UUID entry points share validation/canonicalization; other strings stay untouched.
  for (const [path, record, body] of [
    ['/classes', cls, { guru_kelas: 'Test only' }],
    ['/units', unit, { name: unit.name }],
    ['/students', student, { class_id: cls.id.toUpperCase() }],
    ['/enrollments', enrollment, { student_id: student.id.toUpperCase(), unit_id: unit.id.toUpperCase() }],
    ['/attendance', attendance[0], { student_id: student.id.toUpperCase(), unit_id: unit.id.toUpperCase() }],
    ['/pajsk-scores', score, { student_id: student.id.toUpperCase(), unit_id: unit.id.toUpperCase() }],
    ['/achievements', achievement, { student_id: student.id.toUpperCase(), unit_id: unit.id.toUpperCase() }],
    ['/activities', activity, { unit_id: unit.id.toUpperCase() }],
  ]) {
    const target = `${path}/${record.id.toUpperCase()}`
    const fetched = await req(target)
    assert.equal(fetched.status, 200, `uppercase UUID GET ${path}`)
    assert.equal(fetched.data.id, record.id)
    const updated = await req(target, { method: 'PUT', body })
    assert.equal(updated.status, 200, `uppercase UUID PUT/FK ${path}`)
    assert.equal(updated.data.id, record.id)
    for (const key of ['class_id', 'student_id', 'unit_id']) if (key in body) assert.equal(updated.data[key], body[key].toLowerCase())
    assert.deepEqual((await req(`${path}/${record.id}`)).data, updated.data)
    assert.deepEqual((await req(target, { method: 'PUT', body: {} })).data, updated.data)
  }
  for (const [path, filter, id] of [
    ['/students', 'class_id', cls.id],
    ...['/enrollments', '/attendance', '/pajsk-scores', '/achievements'].flatMap((path) => [[path, 'student_id', student.id], [path, 'unit_id', unit.id]]),
    ['/activities', 'unit_id', unit.id],
  ]) {
    for (const paging of ['', '&page=1&limit=1']) {
      const lower = await req(`${path}?${filter}=${id}${paging}`)
      const upper = await req(`${path}?${filter}=${id.toUpperCase()}${paging}`)
      assert.equal(upper.status, 200, `uppercase UUID filter ${path}/${filter}`)
      assert.deepEqual(upper.data, lower.data)
    }
  }
  assert.equal((await req('/attendance?session=CaseSensitive')).data.length, 1)
  assert.deepEqual((await req('/attendance?session=casesensitive')).data, [])
  const uuidText = unit.id.toUpperCase()
  assert.equal((await req(`/activities/${noDate.id}`, { method: 'PUT', body: { status: uuidText } })).data.status, uuidText)
  assert.equal((await req('/activities?status=' + uuidText)).data[0].id, noDate.id)
  assert.deepEqual((await req('/activities?status=' + unit.id)).data, [])
  await req(`/activities/${noDate.id}`, { method: 'PUT', body: { status: 'dirancang' } })
  for (const invalid of [` ${student.id}`, `${student.id} `, `${student.id}\n`, student.id.replaceAll('-', ''), `{${student.id}}`, 'g' + student.id.slice(1)]) {
    const encoded = encodeURIComponent(invalid)
    for (const method of ['GET', 'PUT', 'DELETE']) {
      const rejected = await req('/students/' + encoded, { method, ...(method === 'PUT' ? { body: { name: 'Must not change' } } : {}) })
      assert.equal(rejected.status, 400, `malformed UUID ${method}`)
      assert.equal(typeof rejected.data.error, 'string')
    }
    for (const path of ['/reports/student/', '/reports/unit/', '/students?class_id=', '/enrollments?student_id=', '/activities?unit_id=']) {
      assert.equal((await req(path + encoded)).status, 400, `malformed UUID ${path}`)
    }
    for (const [path, id, body] of [
      ['/students', student.id, { name: student.name, class_id: invalid }],
      ['/enrollments', enrollment.id, { student_id: invalid, unit_id: unit.id }],
      ['/activities', activity.id, { title: activity.title, unit_id: invalid }],
    ]) {
      assert.equal((await req(path, { method: 'POST', body })).status, 400, `malformed UUID FK POST ${path}`)
      assert.equal((await req(`${path}/${id}`, { method: 'PUT', body })).status, 400, `malformed UUID FK PUT ${path}`)
    }
  }
  for (const path of ['/students?class_id=', '/enrollments?student_id=', '/activities?unit_id=']) assert.equal((await req(path)).status, 400, 'empty UUID filter')
  assert.deepEqual((await req('/students/' + student.id)).data, student)
  assert.equal((await req('/activities')).data[0].id, noDate.id) // PostgreSQL DESC defaults NULLS FIRST.
  const filtered = await req('/students?q=INTEGRATION&class_id=' + cls.id + '&page=1&limit=1')
  assert.equal(filtered.data.total, 1)
  assert.equal(filtered.data.rows.length, 1)
  assert.ok(Array.isArray((await req('/students')).data))
  assert.equal((await req('/attendance?week=2&session=2026&unit_id=' + unit.id)).data[0].present, false)
  assert.equal((await req('/classes?tahun=5')).data.length, 0)
  assert.equal((await req('/units?kind=sukan')).data.length, 0)
  assert.equal((await req('/enrollments?student_id=' + student.id)).data.length, 1)
  assert.equal((await req('/pajsk-scores?session=missing')).data.length, 0)
  assert.equal((await req('/achievements?level=sekolah')).data.length, 1)
  assert.equal((await req('/activities?status=dirancang')).data.length, 2)
  const report = (await req('/reports/student/' + student.id)).data
  assert.deepEqual((await req('/reports/student/' + student.id.toUpperCase())).data, report)
  assert.deepEqual(Object.keys(report).sort(), ['student', 'enrollments', 'scores', 'achievements', 'attendance'].sort())
  assert.deepEqual(report.attendance, [{ unit_id: unit.id, present: 1, total: 3 }])
  assert.equal(report.student.created_at.length > 0, true)
  assert.equal('student' in report.scores[0], false)
  const unitReport = (await req('/reports/unit/' + unit.id)).data
  assert.deepEqual((await req('/reports/unit/' + unit.id.toUpperCase())).data, unitReport)
  assert.equal(unitReport.avgScore, 71)
  assert.equal(unitReport.attendancePct, 33.3)
  assert.equal('unit' in unitReport.members[0], false)
  assert.equal((await req('/reports/student/' + randomUUID())).status, 404)
  assert.equal((await req('/reports/unit/' + randomUUID())).status, 404)
  const stats = (await req('/stats')).data
  assert.deepEqual(Object.keys(stats).sort(), ['totalStudents', 'totalUnits', 'totalAchievements', 'participationPct', 'avgPajsk', 'attendancePct', 'komponen', 'unitAverages', 'gradeDist', 'levelDist', 'topStudents', 'lowAttendance', 'recentActivities'].sort())
  assert.equal(stats.totalStudents, 1)
  assert.equal(stats.avgPajsk, 71)
  assert.equal(stats.participationPct, 100)
  assert.equal(stats.attendancePct, 33.3)
  assert.deepEqual(stats.komponen[0], { kind: 'kelab', units: 1, students: 1, avg: 71 })
  assert.deepEqual(stats.lowAttendance, [{ name: student.name, unit: unit.name, present: 1, total: 3 }])
  assert.deepEqual(stats.topStudents, [{ name: student.name, kelas: cls.name, total: 71, grade: 'B' }])
  assert.equal(stats.recentActivities[0].title, activity.title)
  assert.equal(stats.levelDist.find((x) => x.level === 'negeri').count, 1)
  assert.equal(stats.gradeDist.find((x) => x.grade === 'B').count, 1)
  const settings = { school: 'Integration-only', nested: { keep: [true, 2, null], uuidText } }
  assert.deepEqual((await req('/settings', { method: 'PUT', body: settings })).data, settings)
  assert.deepEqual((await req('/settings')).data, settings)
  assert.equal((await req('/settings', { method: 'PUT', body: [] })).status, 400)
  assert.equal((await req('/settings', { method: 'PUT', body: { school: 'x'.repeat(50001) } })).status, 413)
  assert.equal((await req('/units/' + unit.id, { method: 'PUT', body: { advisor: 'Changed only' }, origin: null })).status, 403)
  assert.equal((await req('/units/' + unit.id, { method: 'PUT', body: { advisor: 'Changed only' } })).data.kind, 'kelab')
  assert.equal((await req('/enrollments/' + enrollment.id, { method: 'PUT', body: { role: 'leader' } })).data.highest_level, 'negeri')
  assert.equal((await req('/students/' + student.id, { method: 'PUT', body: { name: 'Updated student' } })).data.class_id, cls.id)
  assert.equal((await req('/students/' + student.id, { method: 'PUT', body: { class_id: null } })).data.kelas, '')
  const restoredClass = await req('/students/' + student.id.toUpperCase(), { method: 'PUT', body: { class_id: cls.id.toUpperCase() } })
  assert.equal(restoredClass.data.class_id, cls.id)
  assert.equal(restoredClass.data.kelas, cls.name)
  assert.equal(restoredClass.data.tahun, cls.tahun)
  const bulk = await req('/students/bulk', { method: 'POST', body: { rows: [{ name: 'Bulk one', kelas: 'Integration class' }, { name: 'Bulk two', kelas: 'New bulk class', tahun: 6 }, { name: '', kelas: 'invalid' }] } })
  assert.equal(bulk.data.inserted, 2)
  assert.equal(bulk.data.skipped, 1)
  assert.equal(bulk.data.errors[0].row, 3)
  assert.equal((await req('/students/bulk', { method: 'POST', body: { rows: [] } })).status, 400)
  // Exercise aggregation/paging past the old 1000-row cap without an API fixture seed.
  sql("WITH RECURSIVE n(i) AS (VALUES(1) UNION ALL SELECT i+1 FROM n WHERE i<1100) INSERT INTO students(id,name) SELECT printf('00000000-0000-4000-8000-%012d',i),printf('Local scale %04d',i) FROM n")
  assert.equal((await req('/students')).data.length, 1000)
  const page2 = (await req('/students?page=2&limit=1000')).data
  assert.equal(page2.total, 1103)
  assert.equal(page2.rows.length, 103)
  assert.equal((await req('/stats')).data.totalStudents, 1103)
  sql(`INSERT INTO enrollments(student_id,unit_id,highest_level) SELECT id,'${unit.id}','daerah' FROM students WHERE name LIKE 'Local scale %';
    INSERT INTO pajsk_scores(student_id,unit_id,total,grade,m_kehadiran) SELECT id,'${unit.id}',80,'A',80 FROM students WHERE name LIKE 'Local scale %';
    INSERT INTO attendance(student_id,unit_id,present) SELECT id,'${unit.id}',1 FROM students WHERE name LIKE 'Local scale %';
    INSERT INTO achievements(student_id,unit_id,title) SELECT id,'${unit.id}','Local scale award' FROM students WHERE name LIKE 'Local scale %'`)
  const scaleStats = (await req('/stats')).data
  assert.equal(scaleStats.totalAchievements, 1101)
  assert.equal(scaleStats.avgPajsk, Math.round((71 + 1100 * 80) / 1101 * 10) / 10)
  assert.equal(scaleStats.participationPct, Math.round(1101 / 1103 * 1000) / 10)
  assert.equal(scaleStats.attendancePct, Math.round(1101 / 1103 * 1000) / 10)
  assert.equal(scaleStats.komponen[0].students, 1101)
  assert.equal(scaleStats.gradeDist.find((x) => x.grade === 'A').count, 1100)
  assert.equal(scaleStats.levelDist.find((x) => x.level === 'daerah').count, 1100)
  assert.equal((await req('/reports/unit/' + unit.id)).data.members.length, 1101)
  assert.equal((await req('/enrollments?page=2&limit=1000')).data.rows.length, 101)
  const bulkLimitRows = Array.from({ length: 2000 }, (_, i) => ({ name: `Bulk cap ${i}`, kelas: `Bulk cap class ${i}`, tahun: 5 }))
  assert.equal((await req('/students/bulk', { method: 'POST', body: { rows: [...bulkLimitRows, bulkLimitRows[0]] } })).status, 400)
  const bulkLimit = await req('/students/bulk', { method: 'POST', body: { rows: bulkLimitRows } })
  assert.equal(bulkLimit.status, 200)
  assert.deepEqual(bulkLimit.data, { inserted: 2000, skipped: 0, errors: [] })
  assert.equal((await req('/students?q=Bulk%20cap&page=1&limit=1')).data.total, 2000)
  for (const [path, record] of [['/achievements', achievement], ['/activities', activity], ['/attendance', attendance[0]], ['/pajsk-scores', score], ['/enrollments', enrollment]]) {
    assert.equal((await req(`${path}/${record.id.toUpperCase()}`, { method: 'DELETE' })).status, 200)
    assert.equal((await req(`${path}/${record.id}`)).status, 404)
  }
  const disposableStudent = await create('/students', { name: 'UUID deletion only' })
  assert.equal((await req('/students/' + disposableStudent.id.toUpperCase(), { method: 'DELETE' })).status, 200)
  assert.equal((await req('/students/' + disposableStudent.id)).status, 404)
  assert.equal((await req('/units/' + unit.id.toUpperCase(), { method: 'DELETE' })).status, 200)
  assert.equal((await req('/units/' + unit.id)).status, 404)
  assert.equal((await req('/attendance')).data.length, 0)
  assert.equal((await req('/classes/' + cls.id.toUpperCase(), { method: 'DELETE' })).status, 200)
  assert.equal((await req('/classes/' + cls.id)).status, 404)
  assert.equal((await req('/students/' + student.id)).data.class_id, null)
  const attempts = await Promise.all(Array.from({ length: 12 }, () => req('/auth/login', { method: 'POST', body: { password: 'incorrect' }, ip: '192.0.2.99' })))
  assert.equal(attempts.filter((x) => x.status === 401).length, 10)
  assert.equal(attempts.filter((x) => x.status === 429).length, 2)
  assert.equal((await req('/auth/login', { method: 'POST', body: { password }, ip: '192.0.2.99' })).status, 429)
  // Restart the actual Worker: throttling must survive instances and HTTPS must use __Host- cookies.
  await stopServer()
  await startServer(true)
  assert.equal((await req('/auth/login', { method: 'POST', body: { password }, ip: '192.0.2.99' })).status, 429)
  const secureLogin = await req('/auth/login', { method: 'POST', body: { password }, ip: '192.0.2.100' })
  assert.equal(secureLogin.status, 200)
  const secureSetCookie = secureLogin.response.headers.get('set-cookie')
  assert.match(secureSetCookie, /^__Host-koku_session=/)
  assert.match(secureSetCookie, /; Secure/i)
  assert.match(secureSetCookie, /; Path=\//i)
  assert.doesNotMatch(secureSetCookie, /Domain=/i)
  cookie = secureSetCookie.split(';')[0]
  assert.equal((await req('/students')).status, 200)
  sql('UPDATE login_throttles SET window_start=0')
  assert.equal((await req('/auth/login', { method: 'POST', body: { password }, ip: '192.0.2.99' })).status, 200)
  const logout = await req('/auth/logout', { method: 'POST' })
  assert.match(logout.response.headers.get('set-cookie'), /Max-Age=0/)
  assert.equal(logout.status, 200)
  console.log('PASS: real Wrangler/D1 CRUD, UUID case/invalid-input regressions, validation, joins, reports, full-row stats, pagination, settings, atomic PAJSK, FK cascades, origin/auth, concurrent throttle.')
} catch (error) {
  // Never print request payloads, cookies, secrets or operational database rows.
  console.error(error)
  const diagnostic = logs.split('\n').filter((line) => /error|failed|exception/i.test(line)).map((line) => line.replaceAll(password, '[redacted]').replaceAll(secret, '[redacted]')).slice(-10)
  if (diagnostic.length) console.error(diagnostic.join('\n'))
  process.exitCode = 1
} finally {
  await stopServer()
  rmSync(temp, { recursive: true, force: true })
}
