import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const poster = await readFile(
  new URL('../public/no-movie.png', import.meta.url),
)

const movie = (id, title = `Movie ${id}`, extra = {}) => ({
  id,
  title,
  poster_path: `/poster-${id}.jpg`,
  vote_average: 7.8,
  original_language: 'en',
  release_date: '2025-06-15',
  ...extra,
})

const results = (movies, totalPages = 1) => ({
  results: movies,
  total_pages: totalPages,
})
const firstPage = Array.from({ length: 20 }, (_, index) => movie(index + 1))

async function mockMovies(page, handler = () => results(firstPage)) {
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ contentType: 'text/css', body: '' }),
  )
  await page.route('https://image.tmdb.org/**', (route) => {
    if (route.request().url().includes('/broken.jpg')) return route.abort()
    return route.fulfill({ contentType: 'image/png', body: poster })
  })
  await page.route('https://api.themoviedb.org/3/**', async (route) => {
    const url = new URL(route.request().url())
    const body = url.pathname.includes('/trending/')
      ? results(Array.from({ length: 12 }, (_, index) => movie(100 + index)))
      : await handler(url)
    await route.fulfill({
      status: body.status || 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    })
  })
}

async function disableObserver(page) {
  await page.addInitScript(() => {
    window.IntersectionObserver = undefined
  })
}

test('renders popular movies and the top ten weekly trends without Appwrite', async ({
  page,
}) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await mockMovies(page)
  await page.goto('/')
  await expect(page.locator('.movie-card')).toHaveCount(20)
  await expect(page.locator('.trending li')).toHaveCount(10)
  await expect(
    page.getByRole('searchbox', { name: 'Search movies' }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'All Movies', exact: true }),
  ).toBeVisible()
  expect(errors).toEqual([])
})

test('debounces typing and encodes a query containing special characters', async ({
  page,
}) => {
  const queries = []
  await mockMovies(page, (url) => {
    if (url.pathname.includes('/search/'))
      queries.push(url.searchParams.get('query'))
    return results([movie(1)])
  })
  await page.goto('/')
  const input = page.getByRole('searchbox')
  await input.fill('star')
  await page.waitForTimeout(100)
  await input.fill('  Amélie & friends?  ')
  await expect(
    page.getByRole('heading', {
      name: 'Search results for “Amélie & friends?”',
    }),
  ).toBeVisible()
  await expect.poll(() => queries.length).toBe(1)
  expect(queries).toEqual(['Amélie & friends?'])
})

test('keeps the latest results when an older search responds slowly', async ({
  page,
}) => {
  let releaseOldSearch
  const oldSearch = new Promise((resolve) => {
    releaseOldSearch = resolve
  })
  await mockMovies(page, async (url) => {
    const query = url.searchParams.get('query')
    if (query === 'old') {
      await oldSearch
      return results([movie(1, 'Outdated result')])
    }
    return results([
      movie(2, query === 'new' ? 'Current result' : 'Popular result'),
    ])
  })
  await page.goto('/')
  const request = page.waitForRequest((req) => req.url().includes('query=old'))
  await page.getByRole('searchbox').fill('old')
  await request
  await page.getByRole('searchbox').fill('new')
  await expect(
    page.getByRole('heading', { name: 'Current result', exact: true }),
  ).toBeVisible()
  releaseOldSearch()
  await page.waitForTimeout(300)
  await expect(
    page.getByRole('heading', { name: 'Outdated result' }),
  ).toHaveCount(0)
  await expect(page.locator('.movie-card')).toHaveCount(1)
})

test('loads the next page on scroll and removes duplicate movie IDs', async ({
  page,
}) => {
  const pages = []
  await mockMovies(page, (url) => {
    const number = Number(url.searchParams.get('page'))
    pages.push(number)
    return number === 1
      ? results(firstPage, 2)
      : results([movie(20), movie(21)], 2)
  })
  await page.goto('/')
  await expect(page.locator('.movie-card')).toHaveCount(20)
  await page.locator('.movie-card').last().scrollIntoViewIfNeeded()
  await expect(page.locator('.movie-card')).toHaveCount(21)
  await expect(
    page.getByRole('button', { name: 'Load more movies' }),
  ).toHaveCount(0)
  expect(pages.filter((number) => number === 2)).toHaveLength(1)
})

test('retries a failed next page without dropping results or skipping a page', async ({
  page,
}) => {
  await disableObserver(page)
  let secondPageAttempts = 0
  await mockMovies(page, (url) => {
    if (url.searchParams.get('page') === '1') return results(firstPage, 2)
    secondPageAttempts += 1
    return secondPageAttempts === 1
      ? { status: 503, status_message: 'Temporary movie service failure' }
      : results([movie(21)], 2)
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Load more movies' }).click()
  await expect(page.getByRole('alert')).toContainText(
    'Temporary movie service failure',
  )
  await expect(page.locator('.movie-card')).toHaveCount(20)
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.locator('.movie-card')).toHaveCount(21)
  expect(secondPageAttempts).toBe(2)
})

test('resets pagination for a new search and returns to discovery when cleared', async ({
  page,
}) => {
  await disableObserver(page)
  const searchPages = []
  await mockMovies(page, (url) => {
    if (url.pathname.includes('/search/')) {
      searchPages.push(url.searchParams.get('page'))
      return results([movie(99, 'Search match')])
    }
    return url.searchParams.get('page') === '1'
      ? results(firstPage, 2)
      : results([movie(21)], 2)
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Load more movies' }).click()
  await expect(page.locator('.movie-card')).toHaveCount(21)
  await page.getByRole('searchbox').fill('match')
  await expect(page.locator('.movie-card')).toHaveCount(1)
  await expect(page.locator('.movie-card h3')).toHaveText('Search match')
  expect(searchPages).toEqual(['1'])
  await page.getByRole('searchbox').fill('   ')
  await expect(
    page.getByRole('heading', { name: 'All Movies', exact: true }),
  ).toBeVisible()
  await expect(page.locator('.movie-card')).toHaveCount(20)
})

test('shows an empty state and recovers from an initial request failure', async ({
  page,
}) => {
  let fail = true
  await mockMovies(page, (url) => {
    if (url.pathname.includes('/search/')) return results([])
    if (fail) return { status: 500, status_message: 'Could not load movies' }
    return results([movie(1)])
  })
  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText('Could not load movies')
  fail = false
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.locator('.movie-card')).toHaveCount(1)
  await page.getByRole('searchbox').fill('no-match')
  await expect(page.getByRole('status')).toHaveText(
    'No movies found. Try another title.',
  )
})

test('falls back for missing metadata and broken poster URLs', async ({
  page,
}) => {
  await mockMovies(page, () =>
    results([
      movie(1, 'Missing metadata', {
        poster_path: null,
        vote_average: 0,
        release_date: '',
        original_language: '',
      }),
      movie(2, 'Broken poster', { poster_path: '/broken.jpg' }),
    ]),
  )
  await page.goto('/')
  const missing = page
    .locator('.movie-card')
    .filter({ hasText: 'Missing metadata' })
  await expect(missing.getByText('N/A', { exact: true })).toHaveCount(3)
  await expect(page.getByAltText('Missing metadata poster')).toHaveAttribute(
    'src',
    '/no-movie.png',
  )
  await expect(page.getByAltText('Broken poster poster')).toHaveAttribute(
    'src',
    '/no-movie.png',
  )
})

test('supports keyboard pagination when IntersectionObserver is unavailable', async ({
  page,
}) => {
  await disableObserver(page)
  await mockMovies(page, (url) =>
    url.searchParams.get('page') === '1'
      ? results(firstPage, 2)
      : results([movie(21)], 2),
  )
  await page.goto('/')
  const button = page.getByRole('button', { name: 'Load more movies' })
  await button.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.movie-card')).toHaveCount(21)
})

test('fits a narrow mobile viewport without horizontal page overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await mockMovies(page)
  await page.goto('/')
  await expect(page.locator('.movie-card')).toHaveCount(20)
  const fits = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  )
  expect(fits).toBe(true)
})
