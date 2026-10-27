import { useCallback, useEffect, useRef, useState } from 'react'
import Search from './components/Search.jsx'
import Spinner from './components/Spinner.jsx'
import MovieCard from './components/MovieCard.jsx'
import MoviePoster from './components/MoviePoster.jsx'

import { useDebounce } from 'react-use'
import { updateSearchCount } from './appwrite.js'

const API_BASE_URL = 'https://api.themoviedb.org/3'

const API_KEY = import.meta.env.VITE_TMDB_API_KEY?.trim()

const API_OPTIONS = {
  method: 'GET',
  headers: {
    accept: 'application/json',
    Authorization: `Bearer ${API_KEY}`,
  },
}

const MAX_TMDB_PAGES = 500
const TRENDING_MOVIE_LIMIT = 10

const App = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [movieList, setMovieList] = useState([])
  const [trendingMovies, setTrendingMovies] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [requestVersion, setRequestVersion] = useState(0)
  const loadMoreRef = useRef(null)
  const loadMoreLockedRef = useRef(false)
  const requestIdRef = useRef(0)
  const trackedSearchRef = useRef('')
  const isWaitingForSearch = searchTerm.trim() !== debouncedSearchTerm

  const loadMoreMovies = useCallback(() => {
    if (
      searchTerm.trim() !== debouncedSearchTerm ||
      isLoading ||
      isLoadingMore ||
      errorMessage ||
      !hasMore ||
      loadMoreLockedRef.current
    )
      return

    loadMoreLockedRef.current = true
    setPage((currentPage) => Math.min(currentPage + 1, totalPages))
  }, [
    searchTerm,
    debouncedSearchTerm,
    isLoading,
    isLoadingMore,
    errorMessage,
    hasMore,
    totalPages,
  ])

  // Debounce the search term to prevent too many API requests
  useDebounce(
    () => {
      const normalizedSearchTerm = searchTerm.trim()
      if (normalizedSearchTerm === debouncedSearchTerm) return

      trackedSearchRef.current = ''
      setDebouncedSearchTerm(normalizedSearchTerm)
      setPage(1)
      setTotalPages(1)
      setHasMore(false)
    },
    500,
    [searchTerm],
  )

  useEffect(() => {
    if (!API_KEY) return

    const controller = new AbortController()

    const fetchTrendingMovies = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/trending/movie/week?language=en-US`,
          { ...API_OPTIONS, signal: controller.signal },
        )

        if (!response.ok) {
          throw new Error('Failed to fetch trending movies')
        }

        const data = await response.json()
        if (controller.signal.aborted) return
        setTrendingMovies((data.results ?? []).slice(0, TRENDING_MOVIE_LIMIT))
      } catch (error) {
        if (error.name === 'AbortError') return
        console.error('Error fetching trending movies:', error)
      }
    }

    fetchTrendingMovies()

    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const requestId = ++requestIdRef.current

    const fetchMovies = async (query = '', pageNumber = 1) => {
      if (pageNumber === 1) {
        loadMoreLockedRef.current = false
        setIsLoading(true)
        setIsLoadingMore(false)
        setMovieList([])
      } else {
        setIsLoadingMore(true)
      }

      setErrorMessage('')

      const trimmedQuery = query.trim()
      const endpoint = trimmedQuery
        ? `${API_BASE_URL}/search/movie?query=${encodeURIComponent(trimmedQuery)}&page=${pageNumber}`
        : `${API_BASE_URL}/discover/movie?sort_by=popularity.desc&page=${pageNumber}`

      try {
        if (!API_KEY) {
          throw new Error(
            'Movie discovery needs a TMDB API Read Access Token. See the README for setup instructions.',
          )
        }

        const response = await fetch(endpoint, {
          ...API_OPTIONS,
          signal: controller.signal,
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => null)
          throw new Error(errorData?.status_message || 'Failed to fetch movies')
        }

        const data = await response.json()
        if (controller.signal.aborted || requestId !== requestIdRef.current)
          return

        const movies = data.results ?? []
        const cappedTotalPages = Math.min(data.total_pages ?? 0, MAX_TMDB_PAGES)

        setTotalPages(cappedTotalPages)
        setHasMore(pageNumber < cappedTotalPages && movies.length > 0)
        setMovieList((currentMovies) => {
          if (pageNumber === 1) return movies

          const moviesById = new Map(
            currentMovies.map((movie) => [movie.id, movie]),
          )

          movies.forEach((movie) => moviesById.set(movie.id, movie))
          return [...moviesById.values()]
        })

        if (
          pageNumber === 1 &&
          trimmedQuery &&
          movies.length > 0 &&
          trackedSearchRef.current !== trimmedQuery
        ) {
          trackedSearchRef.current = trimmedQuery
          void updateSearchCount(trimmedQuery, movies[0])
        }
      } catch (error) {
        if (error.name === 'AbortError' || requestId !== requestIdRef.current)
          return

        console.error('Error fetching movies:', error)
        setErrorMessage(error.message)
      } finally {
        if (!controller.signal.aborted && requestId === requestIdRef.current) {
          if (pageNumber === 1) {
            setIsLoading(false)
          } else {
            loadMoreLockedRef.current = false
            setIsLoadingMore(false)
          }
        }
      }
    }

    fetchMovies(debouncedSearchTerm, page)

    return () => controller.abort()
  }, [debouncedSearchTerm, page, requestVersion])

  useEffect(() => {
    const loadMoreElement = loadMoreRef.current
    if (!loadMoreElement || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMoreMovies()
      },
      { rootMargin: '400px' },
    )

    observer.observe(loadMoreElement)

    return () => observer.disconnect()
  }, [
    debouncedSearchTerm,
    errorMessage,
    hasMore,
    isLoading,
    isLoadingMore,
    page,
    searchTerm,
    totalPages,
    loadMoreMovies,
  ])

  return (
    <main>
      <div className="pattern" aria-hidden="true" />

      <div className="wrapper">
        <header>
          <img src="/hero.png" alt="" />
          <h1>
            Find <span className="text-gradient"> Movies </span> You'll Enjoy
            Without the Hassle
          </h1>
          <Search searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
        </header>

        {trendingMovies.length > 0 && (
          <section className="trending" aria-labelledby="trending-heading">
            <h2 id="trending-heading">Trending This Week</h2>

            <ul tabIndex={0} aria-label="Weekly trending movies">
              {trendingMovies.map((movie, index) => (
                <li key={movie.id}>
                  <p>{index + 1}</p>
                  <MoviePoster path={movie.poster_path} title={movie.title} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <section
          className="all-movies"
          aria-labelledby="movies-heading"
          aria-busy={isLoading || isLoadingMore}
        >
          <h2 id="movies-heading">
            {debouncedSearchTerm
              ? `Search results for “${debouncedSearchTerm}”`
              : 'All Movies'}
          </h2>
          {isLoading ? (
            <Spinner />
          ) : (
            <>
              {errorMessage && (
                <div className="space-y-3">
                  <p role="alert" className="text-red-400">
                    {errorMessage}
                  </p>
                  <button
                    type="button"
                    className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white"
                    onClick={() => setRequestVersion((version) => version + 1)}
                  >
                    Try again
                  </button>
                </div>
              )}

              {movieList.length > 0 ? (
                <ul>
                  {movieList.map((movie) => (
                    <MovieCard key={movie.id} movie={movie} />
                  ))}
                </ul>
              ) : !errorMessage ? (
                <p role="status" className="text-gray-100">
                  No movies found. Try another title.
                </p>
              ) : null}

              {isLoadingMore && <Spinner label="Loading more movies..." />}

              {!errorMessage && hasMore && (
                <>
                  <div
                    ref={loadMoreRef}
                    className="h-1 w-full"
                    aria-hidden="true"
                  />
                  <button
                    type="button"
                    className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white disabled:opacity-50"
                    onClick={loadMoreMovies}
                    disabled={isLoadingMore || isWaitingForSearch}
                  >
                    Load more movies
                  </button>
                </>
              )}
            </>
          )}
        </section>
        <footer className="mt-20 border-t border-light-100/10 pt-6 text-sm text-light-200">
          <h2 className="sr-only">Credits</h2>
          <a
            className="inline-block"
            href="https://www.themoviedb.org/"
            aria-label="Movie data from TMDB"
          >
            <img src="/tmdb-logo.svg" alt="TMDB" width="120" height="16" />
          </a>
          <p className="mt-2">
            This product uses the TMDB API but is not endorsed or certified by
            TMDB.
          </p>
        </footer>
      </div>
    </main>
  )
}

export default App
