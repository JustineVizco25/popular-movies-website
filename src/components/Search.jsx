const Search = ({ searchTerm, setSearchTerm }) => {
  return (
    <div className="search">
      <div>
        <img src="/search.svg" alt="" aria-hidden="true" />
        <label htmlFor="movie-search" className="sr-only">
          Search movies
        </label>
        <input
          id="movie-search"
          type="search"
          autoComplete="off"
          placeholder="Search through thousands of movies"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
    </div>
  )
}

export default Search
