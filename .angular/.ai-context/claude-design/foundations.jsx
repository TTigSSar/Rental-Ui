// foundations.jsx — Design System / Foundations section
// Tokens + Type scale + Components reference

function SwatchRow({ label, value, hex, contrast }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 40, height: 40, background: value, borderRadius: 8, boxShadow: '0 0 0 1px rgba(0,0,0,.05)' }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#1A1B26' }}>{label}</div>
        <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: '#6B6A75' }}>{hex}</div>
      </div>
      {contrast && <div style={{ fontSize: 10, color: '#0E8A5F', fontWeight: 600 }}>{contrast}</div>}
    </div>
  );
}

function PaletteCard({ tokens }) {
  const t = tokens;
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: 18, border: '1px solid #ECE9E2', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1A1B26' }}>{t.name}</h3>
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.04em', color: t.primary, textTransform: 'uppercase' }}>{t.tag}</span>
      </div>
      <p style={{ margin: '0 0 14px', fontSize: 12, color: '#6B6A75', lineHeight: 1.5 }}>{t.desc}</p>
      <div style={{ display: 'grid', gap: 10 }}>
        <SwatchRow label="Primary" value={t.primary} hex={t.primary} />
        <SwatchRow label="Primary soft" value={t.primarySoft} hex={t.primarySoft} />
        <SwatchRow label="Accent" value={t.accent} hex={t.accent} />
        <SwatchRow label="Background" value={t.bg} hex={t.bg} />
        <SwatchRow label="Surface" value={t.surface} hex={t.surface} />
        <SwatchRow label="Border" value={t.border} hex={t.border} />
        <SwatchRow label="Text" value={t.text} hex={t.text} />
        <SwatchRow label="Success" value={t.success} hex={t.success} />
      </div>
      <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px dashed #ECE9E2',
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11, color: '#6B6A75' }}>
        <div>radius: <span style={{ color: '#1A1B26', fontWeight: 600 }}>{t.radius}px</span></div>
        <div>card: <span style={{ color: '#1A1B26', fontWeight: 600 }}>{t.radiusCard}px</span></div>
        <div>pill: <span style={{ color: '#1A1B26', fontWeight: 600 }}>{t.radiusPill}px</span></div>
        <div>heading: <span style={{ color: '#1A1B26', fontWeight: 600 }}>{t.weightHeading}</span></div>
      </div>
    </div>
  );
}

function TypeScaleCard() {
  const items = [
    { tag: 'Display / H1', size: 32, weight: 700, sample: 'Rent toys nearby' },
    { tag: 'Heading / H2', size: 24, weight: 700, sample: 'Popular this week' },
    { tag: 'Heading / H3', size: 18, weight: 700, sample: 'Section title' },
    { tag: 'Title / H4',   size: 16, weight: 600, sample: 'Card title' },
    { tag: 'Body L',       size: 16, weight: 400, sample: 'Long-form description, 1.5 line-height.' },
    { tag: 'Body',         size: 14, weight: 400, sample: 'Default body, 1.5 line-height.' },
    { tag: 'Label',        size: 13, weight: 600, sample: 'BUTTON / FIELD LABEL' },
    { tag: 'Caption',      size: 12, weight: 500, sample: 'Meta, helper text, location' },
    { tag: 'Micro',        size: 11, weight: 600, sample: 'BADGE · 2–4 YRS' },
  ];
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #ECE9E2' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Type scale — Inter</h3>
        <span style={{ fontSize: 11, color: '#6B6A75', fontFamily: "'JetBrains Mono',monospace" }}>1.25 ratio · 1.5 line-height base</span>
      </div>
      {items.map((i, k) => (
        <div key={k} style={{ display: 'grid', gridTemplateColumns: '120px 60px 1fr', alignItems: 'baseline',
          gap: 16, padding: '10px 0', borderBottom: k < items.length - 1 ? '1px solid #F4F1EB' : 'none' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#6B6A75', letterSpacing: '.04em', textTransform: 'uppercase' }}>{i.tag}</span>
          <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: '#6B6A75' }}>{i.size}/{i.weight}</span>
          <span style={{ fontSize: i.size, fontWeight: i.weight, color: '#1A1B26', lineHeight: 1.25 }}>{i.sample}</span>
        </div>
      ))}
    </div>
  );
}

function SpacingCard() {
  const steps = [
    { name: 'xs', px: 4 }, { name: 'sm', px: 8 }, { name: 'md', px: 12 },
    { name: 'base', px: 16 }, { name: 'lg', px: 24 }, { name: 'xl', px: 32 },
    { name: '2xl', px: 48 }, { name: '3xl', px: 64 },
  ];
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #ECE9E2' }}>
      <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>Spacing — 4px baseline</h3>
      <div style={{ display: 'grid', gap: 8 }}>
        {steps.map((s, k) => (
          <div key={k} style={{ display: 'grid', gridTemplateColumns: '64px 56px 1fr', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>space-{s.name}</span>
            <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: '#6B6A75' }}>{s.px}px</span>
            <div style={{ height: 12, width: s.px * 2, background: '#FF6008', borderRadius: 2 }} />
          </div>
        ))}
      </div>
      <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px dashed #ECE9E2', fontSize: 12, color: '#6B6A75', lineHeight: 1.5 }}>
        <strong style={{ color: '#1A1B26' }}>Density rules:</strong> screen edge = 16, card padding = 12–16, list gap = 12, section gap = 24, hero gap = 32.
      </div>
    </div>
  );
}

function ButtonShowcase() {
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #ECE9E2' }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700 }}>Buttons</h3>
      <p style={{ margin: '0 0 18px', fontSize: 12, color: '#6B6A75' }}>Pill radius. Heights 32 / 44 / 52. Min touch target 44px on mobile.</p>
      <div className="mk" style={{ display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Btn variant="primary" size="md">Continue</Btn>
          <Btn variant="primary" size="md" icon="plus">List a toy</Btn>
          <Btn variant="secondary" size="md">Cancel</Btn>
          <Btn variant="dark" size="md">Send request</Btn>
          <Btn variant="soft" size="md">Save</Btn>
          <Btn variant="ghost" size="md">Skip for now</Btn>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Btn variant="primary" size="sm">Apply</Btn>
          <Btn variant="primary" size="lg">Send rental request</Btn>
          <button style={{ width: 44, height: 44, borderRadius: 999, background: '#FF6008', display: 'grid', placeItems: 'center', border: 0 }}>
            <Icon name="plus" size={18} color="#fff" strokeWidth={2.4} />
          </button>
          <button style={{ width: 44, height: 44, borderRadius: 999, background: '#FFEEDC', display: 'grid', placeItems: 'center', border: 0 }}>
            <Icon name="heart" size={18} color="#FF6008" />
          </button>
          <button style={{ width: 44, height: 44, borderRadius: 12, background: '#fff', border: '1.5px solid #E8E5DE', display: 'grid', placeItems: 'center' }}>
            <Icon name="filter" size={18} color="#1A1B26" />
          </button>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', opacity: .55 }}>
          <Btn variant="primary" size="md" style={{ background: '#F4F1EB', color: '#A8AAB0' }}>Disabled</Btn>
          <Btn variant="secondary" size="md">Loading…</Btn>
        </div>
      </div>
    </div>
  );
}

function FormShowcase() {
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #ECE9E2' }}>
      <h3 style={{ margin: '0 0 18px', fontSize: 18, fontWeight: 700 }}>Forms</h3>
      <div className="mk" style={{ display: 'grid', gap: 14 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#1A1B26', display: 'block', marginBottom: 6 }}>Toy name</label>
          <div style={{ height: 48, border: '1.5px solid #FF6008', borderRadius: 12, padding: '0 14px', display: 'flex', alignItems: 'center', background: '#fff', fontSize: 14, color: '#1A1B26', boxShadow: '0 0 0 4px rgba(255,96,8,.1)' }}>
            LEGO Duplo Town Set
          </div>
          <div style={{ fontSize: 11, color: '#6B6A75', marginTop: 4 }}>Helper · keep it short and searchable</div>
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#1A1B26', display: 'block', marginBottom: 6 }}>Category</label>
          <div style={{ height: 48, border: '1.5px solid #E8E5DE', borderRadius: 12, padding: '0 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', fontSize: 14, color: '#6B6A75' }}>
            Select a category <Icon name="chevronD" size={16} color="#6B6A75" />
          </div>
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#D9342B', display: 'block', marginBottom: 6 }}>Daily price</label>
          <div style={{ height: 48, border: '1.5px solid #D9342B', borderRadius: 12, padding: '0 14px', display: 'flex', alignItems: 'center', background: '#fff', fontSize: 14, color: '#1A1B26' }}>
            
          </div>
          <div style={{ fontSize: 11, color: '#D9342B', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Icon name="x" size={11} color="#D9342B" /> Price is required
          </div>
        </div>
      </div>
    </div>
  );
}

function CardShowcase() {
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #ECE9E2' }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700 }}>Toy card variants</h3>
      <p style={{ margin: '0 0 18px', fontSize: 12, color: '#6B6A75' }}>Trust signals now part of card schema: owner, verification, hygiene.</p>
      <div className="mk" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        <ToyCard dir="A" img={TOY_IMGS.lego} title="LEGO Duplo Town"
          owner="Anna · Yerevan" ownerAv={FAMILY_AVS.anna}
          location="Kentron" price="₽1,500" age="2–5 yr" verified hygiene />
        <ToyCard dir="A" img={TOY_IMGS.wooden} title="Wooden balance bike"
          owner="David · Aurora" ownerAv={FAMILY_AVS.david}
          location="Arabkir" price="₽800" age="3–6 yr" verified />
        <ToyCard dir="A" img={TOY_IMGS.plush} title="Plush family pack"
          owner="Marina · Lori" ownerAv={FAMILY_AVS.marina}
          location="Davtashen" price="₽400" age="0–3 yr" hygiene />
      </div>
      <div style={{ marginTop: 20, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Badge tone="success" dir="A">✓ ID verified</Badge>
        <Badge tone="info" dir="A"><Icon name="clean" size={11} /> Hygiene checked</Badge>
        <Badge tone="warn" dir="A">Pending review</Badge>
        <Badge tone="primary" dir="A">New listing</Badge>
        <Badge tone="default" dir="A">Pickup only</Badge>
      </div>
    </div>
  );
}

function PrincipleCard({ num, title, text, tone = '#FF6008' }) {
  return (
    <div style={{ padding: 18, background: '#fff', borderRadius: 12, border: '1px solid #ECE9E2', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{ width: 26, height: 26, borderRadius: 999, background: tone, color: '#fff',
          fontWeight: 700, fontSize: 12, display: 'grid', placeItems: 'center' }}>{num}</div>
        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{title}</h4>
      </div>
      <p style={{ margin: 0, fontSize: 12, color: '#6B6A75', lineHeight: 1.55 }}>{text}</p>
    </div>
  );
}

function FoundationsBoard() {
  return (
    <div style={{ width: 1480, background: '#fff', borderRadius: 12, padding: 32, border: '1px solid #ECE9E2' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', color: '#FF6008', textTransform: 'uppercase' }}>02 · Foundations</div>
        <h2 style={{ margin: '4px 0 6px', fontSize: 32, fontWeight: 800, color: '#1A1B26', letterSpacing: '-0.02em' }}>
          Design tokens — built mobile-first, shipped as variables
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: '#6B6A75', maxWidth: 720, lineHeight: 1.55 }}>
          One source of truth for the Angular app, the Figma library, and AI-assisted codegen. Three direction
          palettes share the same token names so swapping is a single import.
        </p>
      </div>

      {/* Principles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        <PrincipleCard num="1" title="Mobile-first scale" text="Body 14 / target 44 / radius 14. Desktop adapts by widening containers, not rescaling type." />
        <PrincipleCard num="2" title="Trust visible everywhere" text="Owner identity, verification, hygiene and pickup signals live in the card itself — not buried on detail." />
        <PrincipleCard num="3" title="One color does one job" text="Orange = primary action only. Dark navy = trust/branding. Success/warn/danger reserved for system status." />
        <PrincipleCard num="4" title="AI-friendly tokens" text="Flat token names (primary, surface, border, radius-card) so Cursor/Claude can map 1:1 to Tailwind / CSS vars." />
      </div>

      {/* Palettes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <PaletteCard tokens={TOKENS.A} />
        <PaletteCard tokens={TOKENS.B} />
        <PaletteCard tokens={TOKENS.C} />
      </div>

      {/* Type + spacing */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginBottom: 24 }}>
        <TypeScaleCard />
        <SpacingCard />
      </div>

      {/* Components reference */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <ButtonShowcase />
        <FormShowcase />
      </div>
      <CardShowcase />
    </div>
  );
}

Object.assign(window, { FoundationsBoard });
