const AVATAR_COLORS = [
  '#A85542', '#4A6B8A', '#C4984F', '#5A8A7A',
  '#8B6B8B', '#B87A5A', '#6B8B9E', '#9E7E6B',
];

function getColor(name) {
  if (!name) return AVATAR_COLORS[0];
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

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
      style={{ width: size, height: size, background: getColor(name), fontSize }}
      onClick={onClick}
      title={name}
    >
      {getInitials(name)}
    </div>
  );
}
