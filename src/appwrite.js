import { Client, ID, Query, TablesDB } from 'appwrite'

const DATABASE_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID
const TABLE_ID = import.meta.env.VITE_APPWRITE_TABLE_ID
const PROJECT_ID = import.meta.env.VITE_APPWRITE_PROJECT_ID
const APPWRITE_ENDPOINT = import.meta.env.VITE_APPWRITE_ENDPOINT

// Analytics is optional: a fresh checkout must still render without Appwrite.
const isConfigured = [
  DATABASE_ID,
  TABLE_ID,
  PROJECT_ID,
  APPWRITE_ENDPOINT,
].every((value) => typeof value === 'string' && value.trim().length > 0)

let tablesDB

const incrementSearchCount = (row) =>
  tablesDB.incrementRowColumn({
    databaseId: DATABASE_ID,
    tableId: TABLE_ID,
    rowId: row.$id,
    column: 'count',
    value: 1,
  })

export const updateSearchCount = async (searchTerm, movie) => {
  if (!isConfigured) return null

  try {
    tablesDB ??= new TablesDB(
      new Client().setEndpoint(APPWRITE_ENDPOINT).setProject(PROJECT_ID),
    )

    const result = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: TABLE_ID,
      queries: [Query.equal('searchTerm', searchTerm)],
    })

    if (result.rows.length > 0) {
      const row = result.rows[0]

      // Let the database increment atomically when visitors search together.
      return await incrementSearchCount(row)
    }

    return await tablesDB.createRow({
      databaseId: DATABASE_ID,
      tableId: TABLE_ID,
      rowId: ID.unique(),
      data: {
        searchTerm,
        count: 1,
        movie_id: movie.id,
        poster_url: movie.poster_path
          ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
          : '/no-movie.png',
      },
    })
  } catch (error) {
    // A unique searchTerm index can reject simultaneous first searches.
    if (error.code === 409) {
      try {
        const result = await tablesDB.listRows({
          databaseId: DATABASE_ID,
          tableId: TABLE_ID,
          queries: [Query.equal('searchTerm', searchTerm)],
        })
        if (result.rows[0]) return await incrementSearchCount(result.rows[0])
      } catch {
        // Analytics failure must never interrupt movie discovery.
      }
    }
    console.error('Unable to update the search count:', error)
    return null
  }
}
