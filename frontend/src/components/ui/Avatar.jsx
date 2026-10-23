function getInitials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function Avatar({ name, url, size = 36, className = '', onClick }) {
  const fontSize = Math.max(10, size * 0.4);

  if (url) {
    return (
      <div
        className={`rounded-full overflow-hidden flex-shrink-0 ${onClick ? 'cursor-pointer' : ''} ${className}`}
        style={{ width: size, height: size }}
        onClick={onClick}
      >
        <img src={url} alt={name || ''} className="w-full h-full object-cover" />
      </div>
    );
  }

  return (
    <div
      className={`rounded-full flex items-center justify-center flex-shrink-0 font-[var(--font-display)] text-[var(--page)] ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{ width: size, height: size, background: 'var(--primary)', fontSize }}
      onClick={onClick}
      title={name}
    >
      {getInitials(name)}
    </div>
  );
}
