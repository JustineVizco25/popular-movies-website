const Spinner = ({ label = 'Loading movies...' }) => {
  return (
    <div role="status" className="flex items-center gap-3 text-white">
      <svg
        aria-hidden="true"
        className="h-8 w-8 animate-spin fill-indigo-600 text-gray-600"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4Z" />
      </svg>

      <span>{label}</span>
    </div>
  )
}

export default Spinner
