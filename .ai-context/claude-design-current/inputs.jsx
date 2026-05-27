// inputs.jsx — Inputs, Select & Dropdown system
// Based on Direction A tokens (Refined Warm). Pill radius preserved as brand DNA;
// new "Outlined" variant introduced for dense forms.

const { useState: useStateI } = React;

// =====================================================
// THE INPUT — single component with anatomy
// =====================================================
function Input({
  label, value, placeholder, helper, error, success,
  leading, trailing, size = 'md', state = 'default',
  variant = 'outlined', required, ...rest
}) {
  const t = TOKENS.A;
  const sizes = {
    sm: { h: 36, fs: 13, px: 12, lblMb: 4, gap: 8 },
    md: { h: 48, fs: 14, px: 14, lblMb: 6, gap: 10 },
    lg: { h: 56, fs: 15, px: 16, lblMb: 6, gap: 10 },
  };
  const s = sizes[size];

  // State → border + ring
  const stateStyles = {
    default:  { border: `1.5px solid ${t.border}`,  ring: 'none' },
    hover:    { border: `1.5px solid ${t.textMute}`, ring: 'none' },
    focus:    { border: `1.5px solid ${t.primary}`, ring: `0 0 0 4px ${t.primary}1A` },
    filled:   { border: `1.5px solid ${t.border}`,  ring: 'none' },
    error:    { border: `1.5px solid ${t.danger}`,  ring: `0 0 0 4px ${t.danger}1A` },
    success:  { border: `1.5px solid ${t.success}`, ring: 'none' },
    disabled: { border: `1.5px solid ${t.border}`,  ring: 'none' },
  };
  const st = stateStyles[state];
  const radius = variant === 'pill' ? 999 : variant === 'filled' ? 12 : t.radius;
  const bg = variant === 'filled' ? t.surfaceAlt : state === 'disabled' ? t.surfaceAlt : t.surface;
  const textCol = state === 'disabled' ? t.textMute : value ? t.text : t.textMute;

  return (
    <div style={{ width: '100%' }}>
      {label && (
        <label style={{
          display: 'flex', alignItems: 'center', gap: 4,
          marginBottom: s.lblMb,
          fontSize: 12, fontWeight: 600,
          color: state === 'error' ? t.danger : state === 'disabled' ? t.textMute : t.text,
        }}>
          {label}
          {required && <span style={{ color: t.danger }}>*</span>}
        </label>
      )}
      <div style={{
        height: s.h, paddingLeft: s.px, paddingRight: s.px,
        borderRadius: radius, background: bg,
        border: st.border, boxShadow: st.ring,
        display: 'flex', alignItems: 'center', gap: s.gap,
        opacity: state === 'disabled' ? .7 : 1,
        transition: 'border-color .12s, box-shadow .12s',
      }}>
        {leading && (
          <span style={{ display: 'inline-flex', color: state === 'focus' ? t.primary : t.textMute }}>
            <Icon name={leading} size={size === 'sm' ? 15 : 18} color="currentColor" />
          </span>
        )}
        <span style={{
          flex: 1, fontSize: s.fs, fontWeight: 500,
          color: textCol,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {value || placeholder}
          {state === 'focus' && !value && (
            <span style={{ display: 'inline-block', width: 1.5, height: s.fs + 4, background: t.primary, verticalAlign: 'middle', marginLeft: -1, animation: 'blink 1s steps(2) infinite' }} />
          )}
        </span>
        {trailing}
      </div>
      {(helper || error) && (
        <div style={{
          marginTop: 4,
          fontSize: 11, fontWeight: 500, lineHeight: 1.45,
          color: state === 'error' ? t.danger : state === 'success' ? t.success : t.textMute,
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          {state === 'error' && <Icon name="x" size={11} color={t.danger} />}
          {state === 'success' && <Icon name="check" size={11} color={t.success} />}
          {error || helper}
        </div>
      )}
    </div>
  );
}

// =====================================================
// SELECT — closed and open states
// =====================================================
function Select({ label, value, placeholder, leading, size = 'md', state = 'default', open, helper }) {
  const t = TOKENS.A;
  const sizes = { sm: 36, md: 48, lg: 56 };
  const padX = size === 'sm' ? 12 : 14;
  const stateStyles = {
    default: { border: `1.5px solid ${t.border}`, ring: 'none' },
    focus:   { border: `1.5px solid ${t.primary}`, ring: `0 0 0 4px ${t.primary}1A` },
    error:   { border: `1.5px solid ${t.danger}`, ring: `0 0 0 4px ${t.danger}1A` },
  };
  const st = stateStyles[state] || stateStyles.default;
  return (
    <div>
      {label && (
        <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: state === 'error' ? t.danger : t.text }}>{label}</label>
      )}
      <div style={{
        height: sizes[size], paddingLeft: padX, paddingRight: padX,
        borderRadius: t.radius, background: t.surface,
        border: st.border, boxShadow: st.ring,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        {leading && <Icon name={leading} size={18} color={t.textMute} />}
        <span style={{ flex: 1, fontSize: size === 'sm' ? 13 : 14, fontWeight: 500, color: value ? t.text : t.textMute }}>
          {value || placeholder}
        </span>
        <Icon name={open ? 'chevronD' : 'chevronD'} size={16} color={state === 'focus' ? t.primary : t.textMute} />
      </div>
      {helper && <div style={{ marginTop: 4, fontSize: 11, color: t.textMute }}>{helper}</div>}
      {open && (
        <div style={{
          marginTop: 6, padding: 6, background: t.surface,
          borderRadius: 12, border: `1px solid ${t.border}`,
          boxShadow: '0 12px 32px rgba(20,15,5,.12)',
        }}>
          {[
            { l: 'LEGO & Bricks', c: 92, sel: true },
            { l: 'Plush & Soft toys', c: 84 },
            { l: 'Wooden toys', c: 56 },
            { l: 'Ride-on & Outdoor', c: 41 },
            { l: 'Puzzles', c: 38 },
          ].map((opt, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 10px', borderRadius: 8,
              background: opt.sel ? t.primarySoft : 'transparent',
              color: opt.sel ? t.primary : t.text,
              fontSize: 13, fontWeight: opt.sel ? 600 : 500,
              cursor: 'pointer',
            }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                {opt.sel && <Icon name="check" size={14} color={t.primary} />}
                {!opt.sel && <div style={{ width: 14 }} />}
                {opt.l}
              </span>
              <span style={{ fontSize: 11, color: opt.sel ? t.primary : t.textMute }}>{opt.c}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =====================================================
// FIELD SHOWCASES (callouts/anatomy)
// =====================================================
function AnatomyDiagram() {
  const t = TOKENS.A;
  return (
    <div style={{ padding: 28, background: '#fff', borderRadius: 14, border: '1px solid #ECE9E2', position: 'relative' }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>Input anatomy</h3>
      <p style={{ margin: '0 0 32px', fontSize: 12, color: t.textMute }}>Every field follows the same five parts. Label is always present, helper is the default narrative slot.</p>

      <div style={{ position: 'relative', maxWidth: 420, margin: '0 auto' }}>
        <Input
          label="Toy name"
          value="LEGO Duplo Town Set"
          leading="grid"
          state="filled"
          helper="Helper · keep it short and searchable"
          trailing={<Icon name="x" size={16} color={t.textMute} />}
        />
        {/* Callouts */}
        <Callout num="1" x={-30} y={-2} side="left" width={160} label="Label · always visible, weight 600, 12px" />
        <Callout num="2" x={36} y={32} side="left" width={160} label="Leading icon · 18px, switches to primary on focus" />
        <Callout num="3" x={170} y={32} side="right" width={160} label="Value or placeholder · 14px, weight 500" />
        <Callout num="4" x={400} y={32} side="right" width={150} label="Trailing action · clear / eye / chevron" />
        <Callout num="5" x={-30} y={86} side="left" width={160} label="Helper text · 11px muted; turns red on error" />
      </div>
    </div>
  );
}

// =====================================================
// CURRENT vs NEW comparison
// =====================================================
function BeforeAfterCard() {
  const t = TOKENS.A;
  return (
    <div style={{ padding: 24, background: '#fff', borderRadius: 14, border: '1px solid #ECE9E2' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Before */}
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 8px', background: '#FFE8E5', color: t.danger, borderRadius: 6, fontSize: 10, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 12 }}>
            Today
          </div>
          {/* Repro of current input — 64px tall, 40px radius, placeholder-only */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ height: 64, borderRadius: 40, background: 'rgb(244,244,248)', border: '1px solid rgb(168,171,176)', padding: '20px', display: 'flex', alignItems: 'center', fontSize: 20, color: 'rgb(168,171,176)', fontFamily: 'Inter', fontWeight: 500 }}>
              Email
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ height: 64, borderRadius: 40, background: 'rgb(244,244,248)', border: '1px solid rgb(168,171,176)', padding: '20px', display: 'flex', alignItems: 'center', fontSize: 20, color: 'rgb(168,171,176)', fontFamily: 'Inter', fontWeight: 500 }}>
              Password
            </div>
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: t.textMute, lineHeight: 1.7 }}>
            <li>Placeholder doubles as label — disappears on type, hurts a11y &amp; recall</li>
            <li>20px text, 64px tall — wastes vertical space on mobile</li>
            <li>No focus / error / disabled states</li>
            <li>No icon affordance; password has no toggle</li>
            <li>Country / city selects render identical to text inputs — no chevron</li>
          </ul>
        </div>

        {/* After */}
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 8px', background: '#E6F4EE', color: t.success, borderRadius: 6, fontSize: 10, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 12 }}>
            Evolved
          </div>
          <div style={{ marginBottom: 14 }}>
            <Input label="Email" placeholder="anna@toyrent.am" leading="mail" helper="We'll never share this." />
          </div>
          <div style={{ marginBottom: 14 }}>
            <Input label="Password" value="••••••••" leading="lock"
              trailing={<Icon name="image" size={16} color={t.textMute} />}
              helper="At least 8 characters" />
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: t.text, lineHeight: 1.7 }}>
            <li>Persistent <strong>label + helper</strong> — placeholder is just an example</li>
            <li>14px text, 48px tall — tighter, scannable on mobile</li>
            <li><strong>Full state matrix:</strong> focus, error, success, disabled, readonly</li>
            <li>Leading icon for type cue, trailing for action (clear / toggle)</li>
            <li>Selects gain a chevron + popover menu (or bottom-sheet on mobile)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// STATES MATRIX
// =====================================================
function StatesMatrix() {
  const t = TOKENS.A;
  const rows = [
    { state: 'default',  value: '',                       placeholder: 'Search toys, brands…', leading: 'search', helper: 'Try "LEGO Duplo"' },
    { state: 'hover',    value: '',                       placeholder: 'Search toys, brands…', leading: 'search', helper: 'Try "LEGO Duplo"' },
    { state: 'focus',    value: 'LEGO',                   placeholder: '',                     leading: 'search', helper: 'Press enter to search' },
    { state: 'filled',   value: 'LEGO Duplo Town Set',    placeholder: '',                     leading: 'search' },
    { state: 'error',    value: 'a',                      placeholder: '',                     leading: 'search', error: 'Minimum 2 characters' },
    { state: 'success',  value: 'LEGO Duplo Town',        placeholder: '',                     leading: 'search', helper: '3 matches found' },
    { state: 'disabled', value: 'Search disabled',        placeholder: '',                     leading: 'search', helper: 'Sign in to search' },
  ];
  return (
    <div style={{ padding: 24, background: '#fff', borderRadius: 14, border: '1px solid #ECE9E2' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>State matrix</h3>
        <span style={{ fontSize: 11, color: t.textMute, fontFamily: "'JetBrains Mono',monospace" }}>state="…"</span>
      </div>
      <p style={{ margin: '4px 0 18px', fontSize: 12, color: t.textMute }}>Every input lives in exactly one of these states. Tokens drive the visual difference.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
        {rows.map((r, i) => (
          <div key={i}>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.textMute, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>
              {r.state}
            </div>
            <Input
              value={r.value}
              placeholder={r.placeholder}
              leading={r.leading}
              state={r.state}
              helper={r.helper}
              error={r.error}
              trailing={r.value && r.state !== 'disabled' ? <Icon name="x" size={16} color={t.textMute} /> : null}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// =====================================================
// SIZES & VARIANTS
// =====================================================
function SizesVariants() {
  const t = TOKENS.A;
  return (
    <div style={{ padding: 24, background: '#fff', borderRadius: 14, border: '1px solid #ECE9E2' }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>Sizes &amp; variants</h3>
      <p style={{ margin: '0 0 18px', fontSize: 12, color: t.textMute }}>
        Use <strong>outlined</strong> in forms, <strong>filled</strong> in dense lists, <strong>pill</strong> for the home hero search only.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.textMute, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>SM · 36px</div>
          <Input size="sm" placeholder="Filter…" leading="search" />
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.textMute, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>MD · 48px (default)</div>
          <Input size="md" placeholder="Search toys, brands…" leading="search" />
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.textMute, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>LG · 56px</div>
          <Input size="lg" placeholder="Search 1,400+ toys…" leading="search" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.textMute, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>Outlined</div>
          <Input placeholder="Toy name" value="" />
          <div style={{ fontSize: 10.5, color: t.textMute, marginTop: 8 }}>Default. Forms, wizards, settings.</div>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.textMute, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>Filled</div>
          <Input variant="filled" placeholder="Search this page…" leading="search" />
          <div style={{ fontSize: 10.5, color: t.textMute, marginTop: 8 }}>Inline / toolbar / list-search.</div>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.textMute, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>Pill <span style={{ color: t.primary }}>· brand</span></div>
          <Input variant="pill" size="lg" placeholder="Find a toy near you" leading="search"
            trailing={<button style={{ height: 36, padding: '0 14px', borderRadius: 999, background: t.primary, color: '#fff', border: 0, fontSize: 12, fontWeight: 700 }}>Search</button>} />
          <div style={{ fontSize: 10.5, color: t.textMute, marginTop: 8 }}>Hero search only — keeps brand DNA.</div>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// SPECIALTY INPUTS
// =====================================================
function PasswordWithStrength() {
  const t = TOKENS.A;
  return (
    <div>
      <Input label="Password" value="Toyrent2026!" leading="lock"
        trailing={<Icon name="image" size={16} color={t.textMute} />} />
      <div style={{ marginTop: 8, display: 'flex', gap: 4 }}>
        {[t.success, t.success, t.success, t.surfaceAlt].map((c, i) => (
          <div key={i} style={{ flex: 1, height: 4, background: c, borderRadius: 2 }} />
        ))}
      </div>
      <div style={{ marginTop: 6, fontSize: 11, color: t.textMute, display: 'flex', justifyContent: 'space-between' }}>
        <span>Strength: <strong style={{ color: t.success }}>Strong</strong></span>
        <span>12 chars · 1 number · 1 symbol</span>
      </div>
    </div>
  );
}

function PhoneWithFlag() {
  const t = TOKENS.A;
  return (
    <div>
      <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: t.text }}>Phone number</label>
      <div style={{
        height: 48, padding: '0 14px 0 6px', borderRadius: t.radius,
        background: t.surface, border: `1.5px solid ${t.border}`,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <button style={{
          height: 36, padding: '0 8px 0 10px', borderRadius: 10,
          background: t.surfaceAlt, border: 0,
          display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: t.text,
        }}>
          {/* Armenia flag glyph */}
          <span style={{ display: 'inline-flex', flexDirection: 'column', width: 18, height: 12, borderRadius: 2, overflow: 'hidden', boxShadow: '0 0 0 1px rgba(0,0,0,.08)' }}>
            <span style={{ flex: 1, background: '#D90012' }} />
            <span style={{ flex: 1, background: '#0033A0' }} />
            <span style={{ flex: 1, background: '#F2A800' }} />
          </span>
          +374
          <Icon name="chevronD" size={12} color={t.textMute} />
        </button>
        <div style={{ width: 1, height: 22, background: t.border }} />
        <span style={{ flex: 1, fontSize: 14, color: t.text, fontWeight: 500 }}>77 12 34 56</span>
      </div>
      <div style={{ marginTop: 4, fontSize: 11, color: t.textMute }}>We'll send a 4-digit code to verify.</div>
    </div>
  );
}

function CurrencyInput() {
  const t = TOKENS.A;
  return (
    <div>
      <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: t.text }}>Daily price</label>
      <div style={{
        height: 48, padding: '0 14px 0 0', borderRadius: t.radius,
        background: t.surface, border: `1.5px solid ${t.primary}`,
        boxShadow: `0 0 0 4px ${t.primary}1A`,
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        <span style={{
          height: '100%', padding: '0 14px', borderRight: `1px solid ${t.border}`,
          display: 'inline-flex', alignItems: 'center',
          fontSize: 14, fontWeight: 700, color: t.textMute,
        }}>₽</span>
        <span style={{ flex: 1, padding: '0 12px', fontSize: 14, fontWeight: 600, color: t.text, textAlign: 'right' }}>1,500</span>
        <span style={{ paddingRight: 14, fontSize: 12, color: t.textMute, fontWeight: 500 }}>/ day</span>
      </div>
      <div style={{ marginTop: 4, fontSize: 11, color: t.textMute }}>You'll earn ~₽1,275 after 15% service fee.</div>
    </div>
  );
}

function DateRangeField() {
  const t = TOKENS.A;
  return (
    <div>
      <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: t.text }}>Rental dates</label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, padding: 4, background: t.surfaceAlt, borderRadius: 14 }}>
        <div style={{ padding: '10px 12px', background: t.surface, borderRadius: 10, border: `1.5px solid ${t.primary}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.textMute, letterSpacing: '.04em', textTransform: 'uppercase' }}>Pickup</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginTop: 2 }}>Mon 18 May</div>
        </div>
        <div style={{ padding: '10px 12px', background: t.surface, borderRadius: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.textMute, letterSpacing: '.04em', textTransform: 'uppercase' }}>Return</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginTop: 2 }}>Fri 22 May</div>
        </div>
      </div>
    </div>
  );
}

function TextareaField() {
  const t = TOKENS.A;
  return (
    <div>
      <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: t.text }}>Description</label>
      <div style={{
        minHeight: 100, padding: '12px 14px', borderRadius: t.radius,
        background: t.surface, border: `1.5px solid ${t.border}`,
        fontSize: 14, color: t.text, fontWeight: 500, lineHeight: 1.55,
      }}>
        Gently-used set, all pieces accounted for. Recently sanitized. Includes 3 mini-figures, a vehicle and a track.
      </div>
      <div style={{ marginTop: 4, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: t.textMute }}>
        <span>Tell renters what's included &amp; condition.</span>
        <span>134 / 400</span>
      </div>
    </div>
  );
}

function FileDropField() {
  const t = TOKENS.A;
  return (
    <div>
      <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: t.text }}>Toy photos</label>
      <div style={{
        padding: 18, borderRadius: t.radius,
        background: t.primarySoft, border: `1.5px dashed ${t.primary}`,
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: '#fff', display: 'grid', placeItems: 'center' }}>
          <Icon name="camera" size={22} color={t.primary} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Drop photos here or tap to upload</div>
          <div style={{ fontSize: 11, color: t.textMute, marginTop: 2 }}>Up to 6 photos · JPG / PNG · 8 MB each</div>
        </div>
        <Btn dir="A" variant="primary" size="sm">Choose</Btn>
      </div>
    </div>
  );
}

function SpecialtyShowcase() {
  return (
    <div style={{ padding: 24, background: '#fff', borderRadius: 14, border: '1px solid #ECE9E2' }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>Specialty inputs</h3>
      <p style={{ margin: '0 0 22px', fontSize: 12, color: '#6B6A75' }}>Variants of the base input — each preserves the label / value / helper anatomy.</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <PasswordWithStrength />
        <PhoneWithFlag />
        <CurrencyInput />
        <DateRangeField />
        <TextareaField />
        <FileDropField />
      </div>
    </div>
  );
}

// =====================================================
// SELECT, MULTI-SELECT, COMBOBOX
// =====================================================
function MultiSelectField() {
  const t = TOKENS.A;
  return (
    <div>
      <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: t.text }}>Age range (multi)</label>
      <div style={{
        minHeight: 48, padding: 6, borderRadius: t.radius,
        background: t.surface, border: `1.5px solid ${t.border}`,
        display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
      }}>
        {['0–2 yr', '3–5 yr', '6–8 yr'].map((tag, i) => (
          <span key={i} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '4px 6px 4px 10px', background: t.primarySoft, color: t.primary,
            borderRadius: 8, fontSize: 12, fontWeight: 600,
          }}>
            {tag}
            <button style={{ width: 16, height: 16, borderRadius: 999, background: 'rgba(255,96,8,.15)', border: 0, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
              <Icon name="x" size={10} color={t.primary} />
            </button>
          </span>
        ))}
        <span style={{ flex: 1, paddingLeft: 4, fontSize: 13, color: t.textMute }}>Add more…</span>
        <Icon name="chevronD" size={16} color={t.textMute} />
      </div>
      <div style={{ marginTop: 4, fontSize: 11, color: t.textMute }}>Choose all that apply.</div>
    </div>
  );
}

function ComboboxField() {
  const t = TOKENS.A;
  return (
    <div>
      <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: t.text }}>City</label>
      <div style={{
        height: 48, padding: '0 14px', borderRadius: t.radius,
        background: t.surface, border: `1.5px solid ${t.primary}`,
        boxShadow: `0 0 0 4px ${t.primary}1A`,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <Icon name="pin" size={18} color={t.primary} />
        <span style={{ flex: 1, fontSize: 14, color: t.text, fontWeight: 600 }}>
          Yere<span style={{ display: 'inline-block', width: 1.5, height: 18, background: t.primary, verticalAlign: 'middle', marginLeft: 1, animation: 'blink 1s steps(2) infinite' }} />
        </span>
        <Icon name="x" size={16} color={t.textMute} />
      </div>
      {/* Open menu */}
      <div style={{
        marginTop: 6, padding: 6, background: t.surface,
        borderRadius: 12, border: `1px solid ${t.border}`,
        boxShadow: '0 12px 32px rgba(20,15,5,.12)',
      }}>
        <div style={{ padding: '6px 10px 4px', fontSize: 10, fontWeight: 700, color: t.textMute, letterSpacing: '.08em', textTransform: 'uppercase' }}>Suggested</div>
        {[
          { l: 'Yerevan', sub: 'Capital · 1.1M people', sel: true },
          { l: 'Gyumri', sub: 'Shirak · 121k' },
          { l: 'Vanadzor', sub: 'Lori · 78k' },
        ].map((opt, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 10px', borderRadius: 8,
            background: opt.sel ? t.primarySoft : 'transparent',
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: opt.sel ? t.primary : t.text }}>
                <span style={{ background: '#FFF1B8', borderRadius: 3, padding: '0 2px' }}>Yere</span>
                {opt.l.startsWith('Yere') ? opt.l.slice(4) : opt.l}
              </div>
              <div style={{ fontSize: 11, color: t.textMute, marginTop: 1 }}>{opt.sub}</div>
            </div>
            {opt.sel && <Icon name="check" size={14} color={t.primary} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function SelectsShowcase() {
  return (
    <div style={{ padding: 24, background: '#fff', borderRadius: 14, border: '1px solid #ECE9E2' }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>Selects, multi-select &amp; combobox</h3>
      <p style={{ margin: '0 0 22px', fontSize: 12, color: '#6B6A75' }}>
        Three select flavors, one component family. On mobile, open menus become bottom sheets — see next artboard.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18 }}>
        {/* Single — closed */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6B6A75', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>Single · closed</div>
          <Select label="Category" placeholder="Select a category" leading="grid" />
        </div>
        {/* Single — open */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6B6A75', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>Single · open</div>
          <Select label="Category" value="LEGO &amp; Bricks" leading="grid" open state="focus" />
        </div>
        {/* Combobox / search */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6B6A75', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>Combobox · type to filter</div>
          <ComboboxField />
        </div>
      </div>
      <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18 }}>
        <MultiSelectField />
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6B6A75', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>Segmented · 2–4 options</div>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600 }}>Pickup or delivery</label>
          <div style={{ height: 44, padding: 4, background: TOKENS.A.surfaceAlt, borderRadius: 999, display: 'flex' }}>
            {['Pickup', 'Courier', 'Either'].map((s, i) => (
              <span key={i} style={{
                flex: 1, height: '100%', borderRadius: 999,
                background: i === 0 ? TOKENS.A.surface : 'transparent',
                color: i === 0 ? TOKENS.A.text : TOKENS.A.textMute,
                fontWeight: 600, fontSize: 13,
                display: 'grid', placeItems: 'center',
                boxShadow: i === 0 ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
              }}>{s}</span>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6B6A75', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>Native fallback</div>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600 }}>Quantity</label>
          <div style={{ height: 48, padding: '0 14px', borderRadius: TOKENS.A.radius, background: TOKENS.A.surface, border: `1.5px solid ${TOKENS.A.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 14, color: TOKENS.A.text }}>
            <span>1 toy</span>
            <Icon name="chevronD" size={16} color={TOKENS.A.textMute} />
          </div>
          <div style={{ marginTop: 4, fontSize: 11, color: TOKENS.A.textMute }}>Falls back to OS picker on mobile when {`<10`} options.</div>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// DROPDOWN MENU (popover) — vs Select
// =====================================================
function DropdownMenu() {
  const t = TOKENS.A;
  return (
    <div style={{ padding: 24, background: '#fff', borderRadius: 14, border: '1px solid #ECE9E2' }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>Dropdown menu</h3>
      <p style={{ margin: '0 0 22px', fontSize: 12, color: t.textMute }}>
        Action menu attached to a button or icon — different from a <em>Select</em>, which sets a value.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18, alignItems: 'flex-start' }}>
        {/* Action menu */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.textMute, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>Action menu</div>
          <Btn dir="A" variant="secondary" size="md" icon="filter">Sort: Closest <Icon name="chevronD" size={14} color={t.text} /></Btn>
          <div style={{ marginTop: 8, width: 220, padding: 4, background: t.surface, borderRadius: 12, border: `1px solid ${t.border}`, boxShadow: '0 12px 32px rgba(20,15,5,.12)' }}>
            {[
              { l: 'Closest first', sel: true, icon: 'pin' },
              { l: 'Lowest price', icon: 'tag' },
              { l: 'Highest rated', icon: 'star' },
              { l: 'Newest', icon: 'clock' },
            ].map((opt, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 8,
                background: opt.sel ? t.primarySoft : 'transparent',
                color: opt.sel ? t.primary : t.text,
                fontSize: 13, fontWeight: opt.sel ? 600 : 500,
              }}>
                <Icon name={opt.icon} size={15} color={opt.sel ? t.primary : t.textMute} />
                <span style={{ flex: 1 }}>{opt.l}</span>
                {opt.sel && <Icon name="check" size={14} color={t.primary} />}
              </div>
            ))}
          </div>
        </div>

        {/* Kebab menu */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.textMute, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>Kebab · listing row</div>
          <button style={{ width: 36, height: 36, borderRadius: 999, background: t.surfaceAlt, border: 0, display: 'grid', placeItems: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill={t.text}><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
          </button>
          <div style={{ marginTop: 8, width: 220, padding: 4, background: t.surface, borderRadius: 12, border: `1px solid ${t.border}`, boxShadow: '0 12px 32px rgba(20,15,5,.12)' }}>
            <div style={{ padding: '6px 10px 4px', fontSize: 10, fontWeight: 700, color: t.textMute, letterSpacing: '.08em', textTransform: 'uppercase' }}>Listing</div>
            {[
              { l: 'Edit listing', icon: 'image', sc: '⌘E' },
              { l: 'Duplicate', icon: 'plus', sc: '⌘D' },
              { l: 'Pause', icon: 'clock' },
            ].map((opt, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, fontSize: 13, color: t.text }}>
                <Icon name={opt.icon} size={14} color={t.textMute} />
                <span style={{ flex: 1 }}>{opt.l}</span>
                {opt.sc && <span style={{ fontSize: 10.5, color: t.textMute, fontFamily: "'JetBrains Mono',monospace" }}>{opt.sc}</span>}
              </div>
            ))}
            <div style={{ height: 1, background: t.border, margin: '4px 6px' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, fontSize: 13, color: t.danger }}>
              <Icon name="x" size={14} color={t.danger} />
              <span style={{ flex: 1, fontWeight: 600 }}>Delete</span>
            </div>
          </div>
        </div>

        {/* Profile menu */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.textMute, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>Avatar menu</div>
          <button style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 10px 4px 4px', borderRadius: 999, background: t.surface, border: `1px solid ${t.border}` }}>
            <img src={FAMILY_AVS.anna} style={{ width: 28, height: 28, borderRadius: 999 }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Anna</span>
            <Icon name="chevronD" size={12} color={t.textMute} />
          </button>
          <div style={{ marginTop: 8, width: 240, padding: 6, background: t.surface, borderRadius: 12, border: `1px solid ${t.border}`, boxShadow: '0 12px 32px rgba(20,15,5,.12)' }}>
            <div style={{ padding: 10, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <img src={FAMILY_AVS.anna} style={{ width: 36, height: 36, borderRadius: 999 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Anna Sargsyan</div>
                <div style={{ fontSize: 11, color: t.textMute }}>anna@toyrent.am</div>
              </div>
            </div>
            <div style={{ height: 1, background: t.border, margin: '0 6px 4px' }} />
            {[
              { l: 'My toys', icon: 'grid', meta: '5' },
              { l: 'My rentals', icon: 'calendar', meta: '2' },
              { l: 'Earnings', icon: 'tag', meta: '₽18,400' },
              { l: 'Settings', icon: 'shield' },
              { l: 'Help center', icon: 'message' },
            ].map((opt, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, fontSize: 13, color: t.text }}>
                <Icon name={opt.icon} size={14} color={t.textMute} />
                <span style={{ flex: 1 }}>{opt.l}</span>
                {opt.meta && <span style={{ fontSize: 11, fontWeight: 600, color: t.textMute }}>{opt.meta}</span>}
              </div>
            ))}
            <div style={{ height: 1, background: t.border, margin: '4px 6px' }} />
            <div style={{ padding: '8px 10px', borderRadius: 8, fontSize: 13, color: t.danger, fontWeight: 600 }}>Sign out</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// MOBILE BOTTOM SHEET PICKER (a select on phone)
// =====================================================
function MobileSelectSheet() {
  const t = TOKENS.A;
  return (
    <MScreen dir="A" bg="rgba(15,17,21,.4)">
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,17,21,.4)' }} />
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        background: t.surface, borderRadius: '24px 24px 0 0',
        padding: '12px 16px 28px',
        height: '70%', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ width: 36, height: 4, background: t.border, borderRadius: 4, margin: '0 auto 12px' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Pick a category</h2>
          <button style={{ width: 32, height: 32, borderRadius: 999, background: t.surfaceAlt, border: 0, display: 'grid', placeItems: 'center' }}>
            <Icon name="x" size={16} color={t.text} />
          </button>
        </div>
        {/* Search inside sheet */}
        <Input variant="filled" placeholder="Search categories…" leading="search" size="md" />
        <div style={{ height: 14 }} />
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {[
            { l: 'LEGO & Bricks', c: 92, sel: true, icon: 'grid' },
            { l: 'Plush & Soft toys', c: 84, icon: 'heart' },
            { l: 'Wooden toys', c: 56, icon: 'home' },
            { l: 'Ride-on & Outdoor', c: 41, icon: 'truck' },
            { l: 'Puzzles', c: 38, icon: 'sparkle' },
            { l: 'Board games', c: 28, icon: 'tag' },
          ].map((opt, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 4px', borderBottom: `1px solid ${t.border}`,
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: opt.sel ? t.primarySoft : t.surfaceAlt, display: 'grid', placeItems: 'center' }}>
                <Icon name={opt.icon} size={18} color={opt.sel ? t.primary : t.text} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: opt.sel ? 700 : 600, color: opt.sel ? t.primary : t.text }}>{opt.l}</div>
                <div style={{ fontSize: 11, color: t.textMute, marginTop: 1 }}>{opt.c} toys nearby</div>
              </div>
              {opt.sel
                ? <div style={{ width: 22, height: 22, borderRadius: 999, background: t.primary, display: 'grid', placeItems: 'center' }}>
                    <Icon name="check" size={14} color="#fff" strokeWidth={2.5} />
                  </div>
                : <div style={{ width: 22, height: 22, borderRadius: 999, border: `2px solid ${t.border}` }} />
              }
            </div>
          ))}
        </div>
        <div style={{ paddingTop: 14, display: 'flex', gap: 10 }}>
          <Btn dir="A" variant="secondary" size="lg">Clear</Btn>
          <Btn dir="A" variant="primary" size="lg" style={{ flex: 1 }}>Apply</Btn>
        </div>
      </div>
    </MScreen>
  );
}

// =====================================================
// CONTEXT — full form on a real screen
// =====================================================
function CreateInContext() {
  const t = TOKENS.A;
  return (
    <MScreen dir="A">
      <div style={{ padding: '12px 16px', background: t.surface, borderBottom: `1px solid ${t.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <button style={{ width: 36, height: 36, borderRadius: 999, background: 'transparent', display: 'grid', placeItems: 'center', border: 0 }}>
            <Icon name="chevronL" size={20} color={t.text} />
          </button>
          <span style={{ fontSize: 12, fontWeight: 600, color: t.textMute }}>Step 2 of 4</span>
          <button style={{ background: 'transparent', border: 0, fontSize: 13, fontWeight: 600, color: t.textMute }}>Save draft</button>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {[1,1,0,0].map((s, i) => (
            <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: s ? t.primary : t.surfaceAlt }} />
          ))}
        </div>
      </div>
      <div style={{ height: 'calc(100% - 86px)', overflow: 'hidden', padding: '16px 16px 24px' }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: t.text, letterSpacing: '-0.02em' }}>Tell us about your toy</h1>
        <p style={{ margin: '4px 0 18px', fontSize: 12, color: t.textMute }}>Every field uses the same input system.</p>
        <div style={{ display: 'grid', gap: 14 }}>
          <Input label="Toy name" value="LEGO Duplo Town Set" state="filled" helper="134/60 — keep it short" />
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: t.text }}>Category</label>
            <div style={{ height: 48, padding: '0 14px', borderRadius: t.radius, background: t.surface, border: `1.5px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 24, height: 24, borderRadius: 6, background: t.primarySoft, display: 'grid', placeItems: 'center' }}>
                <Icon name="grid" size={14} color={t.primary} />
              </div>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: t.text }}>LEGO &amp; Bricks</span>
              <Icon name="chevronD" size={16} color={t.textMute} />
            </div>
          </div>
          <CurrencyInput />
          <MultiSelectField />
        </div>
      </div>
    </MScreen>
  );
}

// =====================================================
// USAGE / GUIDELINES
// =====================================================
function InputGuidelines() {
  const t = TOKENS.A;
  return (
    <div style={{ padding: 24, background: '#fff', borderRadius: 14, border: '1px solid #ECE9E2' }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>Rules of thumb</h3>
      <p style={{ margin: '0 0 18px', fontSize: 12, color: t.textMute }}>The same rules apply to every field in the app.</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.success, letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 8 }}>✓ Do</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: t.text, lineHeight: 1.75 }}>
            <li>Always show a label above the field.</li>
            <li>Use placeholder as <em>example</em>, not instruction (e.g. "anna@toyrent.am").</li>
            <li>Use helper text to explain why we ask, not how to type.</li>
            <li>Inline-validate on blur, not on every keystroke.</li>
            <li>Show error <strong>below</strong> the field with an icon &amp; concrete fix.</li>
            <li>Hit target ≥ 44px on mobile (use <code style={{ background: t.surfaceAlt, padding: '1px 5px', borderRadius: 4, fontSize: 11 }}>size="md"</code>).</li>
          </ul>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.danger, letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 8 }}>✗ Don't</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: t.text, lineHeight: 1.75 }}>
            <li>Don't rely on placeholder-as-label.</li>
            <li>Don't use ALL CAPS labels — they break with Armenian / Cyrillic.</li>
            <li>Don't show a red border on first paint of an empty required field.</li>
            <li>Don't put a <em>Select</em> next to a text input with the same look — always include the chevron.</li>
            <li>Don't mix radii in the same form (pill + outlined). Pick one per surface.</li>
            <li>Don't disable the submit button — show the validation, let users try.</li>
          </ul>
        </div>
      </div>

      <div style={{ marginTop: 22, padding: 16, background: '#0F1115', borderRadius: 12 }}>
        <div style={{ fontSize: 10, color: '#A8AAB0', fontWeight: 600, marginBottom: 6, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: "'JetBrains Mono',monospace" }}>Angular usage</div>
        <pre style={{ margin: 0, fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, lineHeight: 1.6, color: '#D1D5DB' }}>{`<tr-input
  label="Daily price"
  type="currency"
  prefix="₽"
  suffix="/ day"
  [formControl]="form.controls.price"
  helper="You'll earn ~85% after fees."
/>

<tr-select
  label="Category"
  [options]="categories"
  [searchable]="true"
  [formControl]="form.controls.category"
/>`}</pre>
      </div>
    </div>
  );
}

// =====================================================
// THE WHOLE BOARD
// =====================================================
function InputsBoard() {
  return (
    <div style={{ width: 1480, background: '#fff', borderRadius: 12, padding: 32, border: '1px solid #ECE9E2' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', color: '#FF6008', textTransform: 'uppercase' }}>11 · Inputs, Select &amp; Dropdown</div>
        <h2 style={{ margin: '4px 0 6px', fontSize: 32, fontWeight: 800, color: '#1A1B26', letterSpacing: '-0.02em' }}>
          One input component, every form gets sharper
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: '#6B6A75', maxWidth: 760, lineHeight: 1.55 }}>
          Current ToyRent forms use placeholder-as-label, no states, no select affordance.
          The evolved system below keeps the brand pill where it matters (hero search),
          and ships a tighter <strong>outlined</strong> default for every form in the product.
        </p>
      </div>

      {/* Before / After */}
      <div style={{ marginBottom: 18 }}>
        <BeforeAfterCard />
      </div>

      {/* Anatomy + States */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 16, marginBottom: 18 }}>
        <AnatomyDiagram />
        <StatesMatrix />
      </div>

      {/* Sizes & variants */}
      <div style={{ marginBottom: 18 }}>
        <SizesVariants />
      </div>

      {/* Specialty */}
      <div style={{ marginBottom: 18 }}>
        <SpecialtyShowcase />
      </div>

      {/* Selects */}
      <div style={{ marginBottom: 18 }}>
        <SelectsShowcase />
      </div>

      {/* Dropdown menu */}
      <div style={{ marginBottom: 18 }}>
        <DropdownMenu />
      </div>

      {/* Guidelines */}
      <div>
        <InputGuidelines />
      </div>
    </div>
  );
}

// Keyframes for blinking caret on focused inputs
if (typeof document !== 'undefined' && !document.getElementById('input-kf')) {
  const s = document.createElement('style');
  s.id = 'input-kf';
  s.textContent = '@keyframes blink{50%{opacity:0}}';
  document.head.appendChild(s);
}

Object.assign(window, {
  Input, Select, MultiSelectField, ComboboxField,
  InputsBoard, MobileSelectSheet, CreateInContext,
});
