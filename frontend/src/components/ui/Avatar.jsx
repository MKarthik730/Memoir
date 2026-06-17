const AVATAR_COLORS = [
  '#7C6A5E', '#8B7A6E', '#9B8B7E', '#6B9E8A',
  '#A68B7B', '#7E8B9B', '#8B7E6B', '#9E7E8B',
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
      className={`rounded-full flex items-center justify-center flex-shrink-0 font-[var(--font-display)] text-white ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{ width: size, height: size, background: getColor(name), fontSize }}
      onClick={onClick}
      title={name}
    >
      {getInitials(name)}
    </div>
  );
}
