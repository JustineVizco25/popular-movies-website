import MoviePoster from './MoviePoster.jsx'

const MovieCard = ({
  movie: { title, vote_average, poster_path, release_date, original_language },
}) => {
  return (
    <li className="movie-card">
      <MoviePoster path={poster_path} title={title} />

      <div className="mt-4">
        <h3>{title}</h3>

        <div className="content">
          <div className="rating">
            <img src="/star.svg" alt="" aria-hidden="true" />
            <p
              aria-label={`Rating: ${vote_average > 0 ? vote_average.toFixed(1) : 'not available'}`}
            >
              {vote_average > 0 ? vote_average.toFixed(1) : 'N/A'}
            </p>
          </div>

          <span>•</span>

          <p className="lang">{original_language || 'N/A'}</p>

          <span>•</span>

          <p className="year">
            {release_date ? release_date.split('-')[0] : 'N/A'}
          </p>
        </div>
      </div>
    </li>
  )
}

export default MovieCard
