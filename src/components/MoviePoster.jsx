const MoviePoster = ({ path, title }) => (
  <img
    src={path ? `https://image.tmdb.org/t/p/w500${path}` : '/no-movie.png'}
    alt={`${title || 'Movie'} poster`}
    loading="lazy"
    onError={(event) => {
      const image = event.currentTarget
      if (image.getAttribute('src') !== '/no-movie.png') {
        image.src = '/no-movie.png'
      }
    }}
  />
)

export default MoviePoster
