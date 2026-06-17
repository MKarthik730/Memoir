import { forwardRef } from 'react';

const variants = {
  primary: 'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]',
  secondary: 'bg-transparent text-[var(--accent)] border border-[var(--accent)] hover:bg-[var(--accent-light)]',
  ghost: 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--accent-lighter)] hover:text-[var(--text)]',
  danger: 'bg-transparent text-[var(--danger)] border border-[var(--danger)] hover:bg-[var(--danger-bg)]',
};

const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-[14px] py-[10px] text-[13px]',
  lg: 'px-6 py-[14px] text-[14px]',
};

const Button = forwardRef(({
  variant = 'primary',
  size = 'md',
  className = '',
  loading = false,
  disabled = false,
  children,
  icon,
  ...props
}, ref) => {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`
        btn
        ${variants[variant] || variants.primary}
        ${sizes[size] || sizes.md}
        ${loading ? 'cursor-wait' : ''}
        ${className}
      `}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      ) : icon ? (
        <span className="flex-shrink-0">{icon}</span>
      ) : null}
      {children}
    </button>
  );
});

Button.displayName = 'Button';
export default Button;
