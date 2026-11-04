import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * Auditoría de accesibilidad WCAG 2.1 AA — Clase 12, Módulo 2
 *
 * Cómo se usa:
 *   1. Correr el informe:   npx playwright test a11y --project=chromium
 *   2. Leer la salida: cada violación muestra la regla de axe, el criterio de éxito
 *      (SC) de WCAG, el nivel y los elementos afectados.
 *   3. Corregir UNA violación en apps/web/src/.
 *   4. Poner el id de esa regla en VERIFICAR.regla (más abajo) y volver a correr:
 *      el test de verificación pasa de rojo a verde cuando la corrección funciona.
 *
 * Requiere la app corriendo (la config de Playwright levanta API y web si no están)
 * y los usuarios de prueba del seed (alice@taskflow.dev / Password1).
 */

// ── Configuración ───────────────────────────────────────────────────────────

const TAGS_WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

/** Completar después de corregir una violación. Ej.: regla: 'label' */
const VERIFICAR: { regla: string | null; vistas: string[] } = {
  regla: null,
  vistas: ['Login'],
}

// ── Vistas a auditar ────────────────────────────────────────────────────────

async function loginComoAlice(page: Page): Promise<void> {
  await page.goto('/login')
  await page.getByTestId('login-email').fill('alice@taskflow.dev')
  await page.getByTestId('login-password').fill('Password1')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL('/projects')
}

const VISTAS: { nombre: string; abrir: (page: Page) => Promise<void> }[] = [
  { nombre: 'Login', abrir: async (page) => { await page.goto('/login') } },
  { nombre: 'Registro', abrir: async (page) => { await page.goto('/register') } },
  {
    nombre: 'Proyectos',
    abrir: async (page) => {
      await loginComoAlice(page)
      await expect(page.getByTestId('project-card').first()).toBeVisible()
    },
  },
  {
    nombre: 'Detalle de proyecto',
    abrir: async (page) => {
      await loginComoAlice(page)
      await page.getByTestId('project-card').first().click()
      await expect(page.getByTestId('task-card').first()).toBeVisible()
    },
  },
]

// ── Utilidades ──────────────────────────────────────────────────────────────

/** 'wcag143' -> '1.4.3' ; 'wcag2410' -> '2.4.10' */
function tagASc(tag: string): string | null {
  const m = /^wcag(\d)(\d)(\d{1,2})$/.exec(tag)
  return m ? `${m[1]}.${m[2]}.${m[3]}` : null
}

function nivel(tags: string[]): string {
  return tags.some((t) => t.endsWith('aa')) ? 'AA' : 'A'
}

async function auditar(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS_WCAG).analyze()
  return violations
}

// ── 1) Informe (no falla: sirve para leer y documentar los hallazgos) ──────

test.describe('Informe de accesibilidad WCAG 2.1 AA', () => {
  for (const vista of VISTAS) {
    test(`${vista.nombre}: informe de violaciones`, async ({ page }, testInfo) => {
      await vista.abrir(page)
      const violations = await auditar(page)

      console.log(`\n=== ${vista.nombre}: ${violations.length} regla(s) violada(s) ===`)
      for (const v of violations) {
        const sc = v.tags.map(tagASc).filter(Boolean).join(', ')
        console.log(`\n[${(v.impact ?? 'n/a').toUpperCase()}] ${v.id} — ${v.help}`)
        console.log(`   SC WCAG: ${sc || 'n/a'}  ·  Nivel ${nivel(v.tags)}`)
        console.log(`   Elementos afectados: ${v.nodes.length}`)
        v.nodes.slice(0, 3).forEach((n) => console.log(`   · ${n.target.join(' ')}`))
        console.log(`   Más info: ${v.helpUrl}`)
      }

      await testInfo.attach(`axe-${vista.nombre}.json`, {
        body: JSON.stringify(violations, null, 2),
        contentType: 'application/json',
      })
    })
  }
})

// ── 2) Verificación de la corrección (rojo → verde) ────────────────────────

test.describe('Verificación de la corrección', () => {
  test.skip(!VERIFICAR.regla, 'Definí VERIFICAR.regla con el id de la regla que corregiste')

  for (const vista of VISTAS.filter((v) => VERIFICAR.vistas.includes(v.nombre))) {
    test(`${vista.nombre}: ya no hay violaciones de "${VERIFICAR.regla}"`, async ({ page }) => {
      await vista.abrir(page)
      const ids = (await auditar(page)).map((v) => v.id)
      expect(ids).not.toContain(VERIFICAR.regla)
    })
  }
})
