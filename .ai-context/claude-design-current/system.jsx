// system.jsx — design tokens + shared mock UI primitives for all directions
// 3 directions: A=Refined Warm (evolution), B=Soft Family, C=Bold Marketplace

const TOKENS = {
  // Direction A — Refined Warm. Closest to current product. Tightened.
  A: {
    name: 'A · Refined Warm',
    tag: 'Evolution',
    desc: 'Closest to today. Tighten hierarchy, add trust signals, polish spacing.',
    bg: '#FAF8F4',
    surface: '#FFFFFF',
    surfaceAlt: '#F4F4F8',
    border: '#E8E5DE',
    text: '#1A1B26',
    textMute: '#6B6A75',
    primary: '#FF6008',
    primaryHover: '#E5530A',
    primarySoft: '#FFEEDC',
    accent: '#2A2C41',
    success: '#0E8A5F',
    warn: '#D97706',
    danger: '#D9342B',
    radius: 14,
    radiusCard: 16,
    radiusPill: 999,
    shadow: '0 1px 2px rgba(20,15,5,.04), 0 8px 24px rgba(20,15,5,.06)',
    fontDisplay: "'Inter',system-ui,sans-serif",
    fontUI: "'Inter',system-ui,sans-serif",
    weightHeading: 700,
  },
  // Direction B — Soft Family. Warmer cream bg, rounder, friendly badges.
  B: {
    name: 'B · Soft Family',
    tag: 'Warmer · Playful',
    desc: 'Cream surfaces, rounded everything, colored age-pills, illustrated empty states.',
    bg: '#FBF5EC',
    surface: '#FFFFFF',
    surfaceAlt: '#F5EFE3',
    border: '#EDE3D2',
    text: '#241B12',
    textMute: '#7B6E5E',
    primary: '#F2620C',
    primaryHover: '#D9530A',
    primarySoft: '#FFE6CC',
    accent: '#5B3B8C',     // softer plum accent
    success: '#1F8A5B',
    warn: '#C97A0A',
    danger: '#D9342B',
    radius: 18,
    radiusCard: 22,
    radiusPill: 999,
    shadow: '0 2px 4px rgba(80,40,10,.04), 0 12px 28px rgba(80,40,10,.06)',
    fontDisplay: "'Inter',system-ui,sans-serif",
    fontUI: "'Inter',system-ui,sans-serif",
    weightHeading: 700,
  },
  // Direction C — Bold Marketplace. Denser, Avito-energy, conversion forward.
  C: {
    name: 'C · Bold Marketplace',
    tag: 'Dense · Conversion',
    desc: 'Tighter cards, stronger price hierarchy, marketplace density à la Avito.',
    bg: '#F4F4F6',
    surface: '#FFFFFF',
    surfaceAlt: '#ECECF0',
    border: '#E1E1E6',
    text: '#0F1115',
    textMute: '#5A5C66',
    primary: '#FF5A1F',
    primaryHover: '#E84F18',
    primarySoft: '#FFE8DA',
    accent: '#1F2937',
    success: '#0E8A5F',
    warn: '#D97706',
    danger: '#D9342B',
    radius: 10,
    radiusCard: 12,
    radiusPill: 8,
    shadow: '0 1px 2px rgba(0,0,0,.04), 0 4px 14px rgba(0,0,0,.06)',
    fontDisplay: "'Inter',system-ui,sans-serif",
    fontUI: "'Inter',system-ui,sans-serif",
    weightHeading: 800,
  },
};

// Curated toy imagery from Unsplash. 400×400 crops, no auth needed.
const TOY_IMGS = {
  lego: 'https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=600&h=600&fit=crop&auto=format',
  plush: 'https://images.unsplash.com/photo-1545558014-8692077e9b5c?w=600&h=600&fit=crop&auto=format',
  wooden: 'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=600&h=600&fit=crop&auto=format',
  cars: 'https://images.unsplash.com/photo-1594787318286-3d835c1d207f?w=600&h=600&fit=crop&auto=format',
  bike: 'https://images.unsplash.com/photo-1532330393533-443990a51d10?w=600&h=600&fit=crop&auto=format',
  doll: 'https://images.unsplash.com/photo-1556012018-50c5c0da73bf?w=600&h=600&fit=crop&auto=format',
  blocks: 'https://images.unsplash.com/photo-1560859251-d563a49c5e4a?w=600&h=600&fit=crop&auto=format',
  puzzle: 'https://images.unsplash.com/photo-1611117775350-ac3950990985?w=600&h=600&fit=crop&auto=format',
  board: 'https://images.unsplash.com/photo-1632501641765-e568d28b0015?w=600&h=600&fit=crop&auto=format',
  scooter: 'https://images.unsplash.com/photo-1599058917765-a780eda07a3e?w=600&h=600&fit=crop&auto=format',
  kitchen: 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=600&h=600&fit=crop&auto=format',
  baby: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=600&h=600&fit=crop&auto=format',
  hero: 'https://images.unsplash.com/photo-1558877385-81a1c7e67d72?w=1200&h=800&fit=crop&auto=format',
};

const FAMILY_AVS = {
  anna: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&auto=format',
  david: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&auto=format',
  marina: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=80&h=80&fit=crop&auto=format',
  aram:   'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&auto=format',
};

// -------------------- Phone Frame --------------------
// A lightweight, drawing-only iPhone bezel so we can fit many side-by-side
// in the design canvas without massive overhead. 390×844 viewport inside.
function Phone({ children, width = 390, height = 844, statusBar = true, label }) {
  const padX = 10;
  return (
    <div style={{
      width: width + padX * 2,
      height: height + padX * 2 + 8,
      background: '#0F1115',
      borderRadius: 48,
      padding: padX,
      position: 'relative',
      boxShadow: '0 0 0 1.5px #2a2c33 inset, 0 30px 60px -20px rgba(0,0,0,.35)',
    }}>
      <div style={{
        width, height,
        borderRadius: 40,
        overflow: 'hidden',
        background: '#fff',
        position: 'relative',
        boxShadow: '0 0 0 1.5px #2a2c33 inset',
      }}>
        {statusBar && <StatusBar />}
        <div className="mk" style={{
          width: '100%', height: statusBar ? 'calc(100% - 44px)' : '100%',
          marginTop: statusBar ? 0 : 0,
          overflow: 'hidden',
          position: 'relative',
          background: '#fff',
        }}>
          {children}
        </div>
        {/* Dynamic island */}
        <div style={{
          position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
          width: 110, height: 32, background: '#0F1115', borderRadius: 999, zIndex: 50,
        }} />
        {/* Home indicator */}
        <div style={{
          position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
          width: 130, height: 4, background: '#0F1115', borderRadius: 4, opacity: .9, zIndex: 50,
        }} />
      </div>
    </div>
  );
}

function StatusBar(){
  return (
    <div style={{
      height: 44, padding: '0 28px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      fontSize: 15, fontWeight: 600, color: '#0F1115',
      position: 'relative', zIndex: 40,
    }}>
      <span>9:41</span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <Icon name="signal" size={16} />
        <Icon name="wifi" size={16} />
        <div style={{ width: 26, height: 12, border: '1.5px solid #0F1115', borderRadius: 3, position: 'relative', padding: 1.5 }}>
          <div style={{ width: '85%', height: '100%', background: '#0F1115', borderRadius: 1 }} />
          <div style={{ position: 'absolute', right: -4, top: 3, width: 2, height: 5, background: '#0F1115', borderRadius: 1 }} />
        </div>
      </div>
    </div>
  );
}

// -------------------- Icon set (minimal, inline SVG) --------------------
function Icon({ name, size = 18, color = 'currentColor', strokeWidth = 2 }) {
  const p = { width: size, height: size, fill: 'none', stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round', viewBox: '0 0 24 24' };
  switch (name) {
    case 'search':   return <svg {...p}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>;
    case 'home':     return <svg {...p}><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/></svg>;
    case 'grid':     return <svg {...p}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>;
    case 'plus':     return <svg {...p}><path d="M12 5v14M5 12h14"/></svg>;
    case 'calendar': return <svg {...p}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>;
    case 'user':     return <svg {...p}><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg>;
    case 'heart':    return <svg {...p}><path d="M12 21s-7-4.5-9.5-9C1 8.7 3.3 5 7 5c2 0 3.5 1 5 3 1.5-2 3-3 5-3 3.7 0 6 3.7 4.5 7-2.5 4.5-9.5 9-9.5 9z"/></svg>;
    case 'filter':   return <svg {...p}><path d="M4 5h16M7 12h10M10 19h4"/></svg>;
    case 'star':     return <svg {...p} fill={color} stroke="none"><path d="M12 2l3 6.5 7 1-5 5 1.5 7-6.5-3.5L5.5 21 7 14 2 9l7-1L12 2z"/></svg>;
    case 'shield':   return <svg {...p}><path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/></svg>;
    case 'check':    return <svg {...p}><path d="M5 13l4 4L19 7"/></svg>;
    case 'chevron':  return <svg {...p}><path d="M9 6l6 6-6 6"/></svg>;
    case 'chevronD': return <svg {...p}><path d="M6 9l6 6 6-6"/></svg>;
    case 'chevronL': return <svg {...p}><path d="M15 6l-6 6 6 6"/></svg>;
    case 'arrow':    return <svg {...p}><path d="M5 12h14M13 5l7 7-7 7"/></svg>;
    case 'pin':      return <svg {...p}><path d="M12 22s7-7 7-12a7 7 0 10-14 0c0 5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>;
    case 'camera':   return <svg {...p}><path d="M5 8h3l2-2h4l2 2h3a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V10a2 2 0 012-2z"/><circle cx="12" cy="13" r="3.5"/></svg>;
    case 'wifi':     return <svg {...p} fill={color} stroke="none"><path d="M2 8a16 16 0 0120 0l-2 2.3a13 13 0 00-16 0L2 8zm3.5 4a12 12 0 0113 0l-2 2.3a9 9 0 00-9 0L5.5 12zM12 15.5a4 4 0 00-3.5 2L12 21l3.5-3.5a4 4 0 00-3.5-2z"/></svg>;
    case 'signal':   return <svg {...p} fill={color} stroke="none"><rect x="2" y="14" width="3" height="6" rx="1"/><rect x="7" y="10" width="3" height="10" rx="1"/><rect x="12" y="6" width="3" height="14" rx="1"/><rect x="17" y="2" width="3" height="18" rx="1"/></svg>;
    case 'message':  return <svg {...p}><path d="M21 12a8 8 0 11-3.5-6.6L21 4l-1 5"/></svg>;
    case 'bell':     return <svg {...p}><path d="M6 18V11a6 6 0 1112 0v7l1.5 2H4.5L6 18z"/><path d="M10 22a2 2 0 004 0"/></svg>;
    case 'sparkle':  return <svg {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.5 5.5l2.8 2.8M15.7 15.7l2.8 2.8M5.5 18.5l2.8-2.8M15.7 8.3l2.8-2.8"/></svg>;
    case 'verified': return <svg {...p} fill={color} stroke="none"><path d="M12 1l2.5 2.6 3.6-.5.5 3.6L21 9l-1.5 3 1.5 3-2.4 1.3-.5 3.6-3.6-.5L12 23l-2.5-2.6-3.6.5-.5-3.6L3 15l1.5-3L3 9l2.4-1.3.5-3.6 3.6.5L12 1z" fill={color}/><path d="M8 12l3 3 5-6" stroke="#fff" strokeWidth="2.2"/></svg>;
    case 'clean':    return <svg {...p}><path d="M9 3h6l-1 3h-4L9 3z"/><path d="M8 6h8l1 4-1 10H8L7 10l1-4z"/><path d="M11 12v4M13 12v4"/></svg>;
    case 'tag':      return <svg {...p}><path d="M3 12V4h8l10 10-8 8L3 12z"/><circle cx="8" cy="8" r="1.5" fill={color}/></svg>;
    case 'clock':    return <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    case 'menu':     return <svg {...p}><path d="M4 6h16M4 12h16M4 18h16"/></svg>;
    case 'x':        return <svg {...p}><path d="M6 6l12 12M18 6L6 18"/></svg>;
    case 'image':    return <svg {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 16l-5-5-9 9"/></svg>;
    case 'truck':    return <svg {...p}><rect x="1" y="6" width="13" height="10" rx="1"/><path d="M14 9h4l3 3v4h-7V9z"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>;
    case 'mail':     return <svg {...p}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>;
    case 'flag':     return <svg {...p}><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>;
    case 'lock':     return <svg {...p}><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>;
    case 'glob':     return <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/></svg>;
    case 'mic':      return <svg {...p}><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/></svg>;
    default:         return <svg {...p}><circle cx="12" cy="12" r="9"/></svg>;
  }
}

// -------------------- Mock building blocks --------------------
// Generic toy card used inside mobile screens (variants per direction)
function ToyCard({ img, title, owner, ownerAv, location, price, age, verified, hygiene, dir = 'A', size = 'md' }) {
  const t = TOKENS[dir];
  const compact = size === 'sm';
  return (
    <div style={{
      background: t.surface, borderRadius: t.radiusCard,
      border: `1px solid ${t.border}`, overflow: 'hidden',
      boxShadow: dir === 'C' ? 'none' : t.shadow,
    }}>
      <div style={{ position: 'relative', aspectRatio: '1/1', background: t.surfaceAlt }}>
        <img src={img} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <button style={{
          position: 'absolute', top: 8, right: 8,
          width: 32, height: 32, borderRadius: 999,
          background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(8px)',
          display: 'grid', placeItems: 'center', boxShadow: '0 2px 6px rgba(0,0,0,.12)',
        }}>
          <Icon name="heart" size={16} color={t.textMute} />
        </button>
        {age && (
          <div style={{
            position: 'absolute', bottom: 8, left: 8,
            background: 'rgba(255,255,255,.95)', backdropFilter: 'blur(8px)',
            padding: '3px 8px', borderRadius: t.radiusPill,
            fontSize: 11, fontWeight: 600, color: t.text,
          }}>{age}</div>
        )}
      </div>
      <div style={{ padding: compact ? '8px 10px 10px' : '10px 12px 12px' }}>
        <div style={{ fontSize: compact ? 13 : 14, fontWeight: 600, color: t.text, lineHeight: 1.25,
          display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, fontSize: 11, color: t.textMute }}>
          <Icon name="pin" size={11} color={t.textMute} strokeWidth={2} />
          <span>{location}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: compact ? 6 : 8 }}>
          <span style={{ fontSize: compact ? 14 : 16, fontWeight: 700, color: t.primary }}>
            {price}
          </span>
          <span style={{ fontSize: 11, color: t.textMute }}>/ day</span>
        </div>
        {!compact && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8,
            paddingTop: 8, borderTop: `1px solid ${t.border}` }}>
            <img src={ownerAv} alt={owner}
              style={{ width: 18, height: 18, borderRadius: 999, objectFit: 'cover' }} />
            <span style={{ fontSize: 11, color: t.textMute, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {owner}
            </span>
            {verified && <Icon name="verified" size={14} color={t.success} />}
            {hygiene && <Icon name="clean" size={13} color={t.accent} />}
          </div>
        )}
      </div>
    </div>
  );
}

// Generic button
function Btn({ children, variant = 'primary', size = 'md', dir = 'A', full, icon, onClick, style }) {
  const t = TOKENS[dir];
  const sizes = {
    sm: { h: 32, px: 12, fs: 13, gap: 6, ic: 14 },
    md: { h: 44, px: 18, fs: 14, gap: 8, ic: 16 },
    lg: { h: 52, px: 22, fs: 15, gap: 10, ic: 18 },
  };
  const s = sizes[size];
  const variants = {
    primary: { bg: t.primary, color: '#fff', border: 'none' },
    secondary: { bg: t.surface, color: t.text, border: `1.5px solid ${t.border}` },
    ghost: { bg: 'transparent', color: t.text, border: 'none' },
    dark: { bg: t.accent, color: '#fff', border: 'none' },
    soft: { bg: t.primarySoft, color: t.primary, border: 'none' },
  };
  const v = variants[variant];
  return (
    <button onClick={onClick} style={{
      height: s.h, padding: `0 ${s.px}px`, borderRadius: t.radiusPill,
      background: v.bg, color: v.color, border: v.border,
      fontSize: s.fs, fontWeight: 600, fontFamily: 'inherit',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: s.gap,
      width: full ? '100%' : 'auto', whiteSpace: 'nowrap',
      ...style,
    }}>
      {icon && <Icon name={icon} size={s.ic} />}
      {children}
    </button>
  );
}

// Header used inside mobile screens
function MHeader({ dir = 'A', title, back, action }) {
  const t = TOKENS[dir];
  return (
    <div style={{
      height: 52, padding: '0 12px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: t.surface, borderBottom: `1px solid ${t.border}`,
    }}>
      {back ? (
        <button style={{ width: 36, height: 36, display: 'grid', placeItems: 'center', borderRadius: 999, background: 'transparent', border: 0 }}>
          <Icon name="chevronL" size={20} color={t.text} />
        </button>
      ) : <div style={{ width: 36 }} />}
      <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{title}</div>
      {action || <div style={{ width: 36 }} />}
    </div>
  );
}

// Bottom tab bar with center +
function BottomTabs({ dir = 'A', active = 0 }) {
  const t = TOKENS[dir];
  const tabs = [
    { name: 'home', label: 'Home' },
    { name: 'grid', label: 'Browse' },
    { name: 'plus', label: 'List' }, // big center button
    { name: 'calendar', label: 'Rentals' },
    { name: 'user', label: 'Profile' },
  ];
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      paddingBottom: 18, paddingTop: 8,
      background: t.surface, borderTop: `1px solid ${t.border}`,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around',
    }}>
      {tabs.map((tab, i) => {
        const isCenter = i === 2;
        const isActive = i === active;
        if (isCenter) {
          return (
            <button key={i} style={{
              width: 56, height: 56, borderRadius: 999,
              background: t.primary, color: '#fff',
              display: 'grid', placeItems: 'center',
              marginTop: -24,
              boxShadow: `0 8px 20px ${t.primary}55, 0 0 0 4px ${t.surface}`,
              border: 0,
            }}>
              <Icon name="plus" size={26} color="#fff" strokeWidth={2.5} />
            </button>
          );
        }
        return (
          <button key={i} style={{
            background: 'transparent', border: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: 4,
            color: isActive ? t.primary : t.textMute,
          }}>
            <Icon name={tab.name} size={22} color={isActive ? t.primary : t.textMute} strokeWidth={isActive ? 2.4 : 2} />
            <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 500 }}>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// Small chips/badges
function Chip({ children, dir = 'A', active, icon }) {
  const t = TOKENS[dir];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '6px 12px', borderRadius: t.radiusPill,
      fontSize: 12, fontWeight: 600,
      background: active ? t.text : t.surface,
      color: active ? t.surface : t.text,
      border: active ? 'none' : `1px solid ${t.border}`,
      whiteSpace: 'nowrap',
    }}>
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  );
}

function Badge({ children, tone = 'default', dir = 'A' }) {
  const t = TOKENS[dir];
  const tones = {
    default: { bg: t.surfaceAlt, color: t.text },
    success: { bg: '#E6F4EE', color: t.success },
    warn:    { bg: '#FFF1DC', color: t.warn },
    info:    { bg: '#E8EAFF', color: '#4A5FE3' },
    primary: { bg: t.primarySoft, color: t.primary },
  };
  const v = tones[tone];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: 6,
      fontSize: 11, fontWeight: 600,
      background: v.bg, color: v.color,
    }}>{children}</span>
  );
}

// Sectioned page wrapper (full mobile screen, with scroll appearance)
function MScreen({ dir = 'A', children, style, bg }) {
  const t = TOKENS[dir];
  return (
    <div style={{
      width: '100%', height: '100%', overflow: 'hidden',
      background: bg || t.bg, position: 'relative',
      ...style,
    }}>
      {children}
    </div>
  );
}

// Section title (for in-app section headers)
function SectionTitle({ dir = 'A', children, action }) {
  const t = TOKENS[dir];
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '16px 16px 8px' }}>
      <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: t.text }}>{children}</h3>
      {action && <span style={{ fontSize: 12, fontWeight: 600, color: t.primary }}>{action}</span>}
    </div>
  );
}

// Annotated callouts for the audit screen
function Callout({ x, y, num, label, side = 'right', width = 200 }) {
  const left = side === 'right' ? x + 30 : x - width - 30;
  return (
    <>
      <div style={{
        position: 'absolute', left: x, top: y,
        width: 22, height: 22, borderRadius: 999,
        background: '#FF6008', color: '#fff', fontWeight: 700, fontSize: 12,
        display: 'grid', placeItems: 'center',
        boxShadow: '0 4px 10px rgba(255,96,8,.4), 0 0 0 3px rgba(255,255,255,.9)',
        zIndex: 5,
      }}>{num}</div>
      <div style={{
        position: 'absolute', left, top: y - 4,
        width, padding: '8px 12px', borderRadius: 8,
        background: '#fff', boxShadow: '0 4px 14px rgba(0,0,0,.08)',
        fontSize: 11, lineHeight: 1.4, color: '#2A2C41',
        border: '1px solid #ECE9E2',
      }}>{label}</div>
    </>
  );
}

// Stickers / floaters used in canvas
function StickyNote({ children, color = '#fef4a8', rotate = 0, width = 280 }) {
  return (
    <div style={{
      width, padding: '14px 16px',
      background: color, borderRadius: 4,
      fontSize: 13, lineHeight: 1.5, color: '#3a2a0a',
      boxShadow: '0 8px 20px rgba(0,0,0,.08), 0 1px 3px rgba(0,0,0,.06)',
      transform: `rotate(${rotate}deg)`,
      fontFamily: "'Inter',sans-serif",
    }}>
      {children}
    </div>
  );
}

Object.assign(window, {
  TOKENS, TOY_IMGS, FAMILY_AVS,
  Phone, StatusBar, Icon,
  ToyCard, Btn, MHeader, BottomTabs, Chip, Badge, MScreen, SectionTitle,
  Callout, StickyNote,
});
