const base = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, className: 'i' }

export const MenuIcon = () => <svg {...base}><path d="M4 7h16M4 12h16M4 17h10" /></svg>
export const BackIcon = () => <svg {...base}><path d="M15 5l-7 7 7 7" /></svg>
export const SendIcon = () => <svg {...base}><path d="M12 19V5M6 11l6-6 6 6" /></svg>
export const CheckIcon = () => <svg {...base} className="i i--sm"><path d="M5 12.5 10 17l9-10" /></svg>
export const SpeakerIcon = () => (
  <svg {...base}><path d="M11 5 6 9H3v6h3l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></svg>
)
