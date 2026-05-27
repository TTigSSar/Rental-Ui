// audit.jsx — Strategy + Audit of current product

function MetricCard({ label, before, after, tone = '#FF6008' }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #ECE9E2' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#6B6A75', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 13, color: '#A8AAB0', textDecoration: 'line-through' }}>{before}</span>
        <Icon name="arrow" size={12} color="#6B6A75" />
        <span style={{ fontSize: 18, fontWeight: 700, color: tone }}>{after}</span>
      </div>
    </div>
  );
}

function IssueCard({ num, severity, title, what, why, fix }) {
  const colors = {
    critical: { bg: '#FFE8E5', text: '#D9342B', dot: '#D9342B' },
    high:     { bg: '#FFF1DC', text: '#C97A0A', dot: '#D97706' },
    medium:   { bg: '#E8EAFF', text: '#4A5FE3', dot: '#4A5FE3' },
  };
  const c = colors[severity];
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 18, border: '1px solid #ECE9E2', display: 'grid', gridTemplateColumns: '36px 1fr', gap: 14 }}>
      <div style={{
        width: 36, height: 36, borderRadius: 999, background: c.bg, color: c.text,
        fontWeight: 700, fontSize: 14, display: 'grid', placeItems: 'center',
      }}>{num}</div>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1A1B26' }}>{title}</h4>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
            background: c.bg, color: c.text, letterSpacing: '.04em', textTransform: 'uppercase',
          }}>{severity}</span>
        </div>
        <div style={{ display: 'grid', gap: 6, fontSize: 12, lineHeight: 1.55, color: '#3A3B47' }}>
          <div><strong style={{ color: '#6B6A75', fontWeight: 600 }}>WHAT · </strong>{what}</div>
          <div><strong style={{ color: '#6B6A75', fontWeight: 600 }}>WHY · </strong>{why}</div>
          <div><strong style={{ color: '#0E8A5F', fontWeight: 600 }}>FIX · </strong>{fix}</div>
        </div>
      </div>
    </div>
  );
}

// Mini reproduction of current home / browse screen (compressed, schematic)
function CurrentHomeMini() {
  return (
    <div style={{ width: 320, height: 600, background: '#fff', borderRadius: 16, overflow: 'hidden', border: '1.5px solid #E8E5DE', position: 'relative', boxShadow: '0 12px 40px rgba(20,15,5,.08)' }}>
      {/* header */}
      <div style={{ height: 44, padding: '0 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F4F1EB' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 20, height: 20, background: '#FF6008', borderRadius: 4 }} />
          <span style={{ fontSize: 13, fontWeight: 700 }}>Toy<span style={{ color: '#FF6008' }}>Rent</span></span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: '#6B6A75' }}>🌐 RU</span>
          <span style={{ fontSize: 10, color: '#6B6A75' }}>Войти</span>
          <span style={{ fontSize: 10, color: '#fff', background: '#FF6008', padding: '3px 8px', borderRadius: 999 }}>Регистрация</span>
        </div>
      </div>
      {/* hero — abstract painted bg */}
      <div style={{ height: 180, background: 'linear-gradient(135deg,#FF8050 0%,#2A2C41 100%)', position: 'relative', padding: 16 }}>
        <div style={{ color: '#fff', fontSize: 13, fontWeight: 700, marginTop: 28, lineHeight: 1.2 }}>Арендуйте<br/>качественные игрушки</div>
        <div style={{ height: 28, background: '#fff', borderRadius: 999, marginTop: 8, display: 'flex', alignItems: 'center', padding: '0 8px', gap: 6 }}>
          <Icon name="search" size={12} color="#6B6A75" />
          <span style={{ fontSize: 10, color: '#A8AAB0' }}>Поиск игрушек…</span>
        </div>
      </div>
      {/* categories – pill overlapping */}
      <div style={{ padding: '24px 12px 8px', position: 'relative' }}>
        <div style={{ position: 'absolute', top: -10, left: 12, background: '#FF6008', color: '#fff', fontSize: 10, padding: '4px 10px', borderRadius: 999, fontWeight: 600 }}>Категории игрушек</div>
        <div style={{ display: 'flex', gap: 6, overflow: 'hidden' }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ flex: '0 0 90px', height: 80, background: '#2A2C41', borderRadius: 6, position: 'relative' }}>
              <Icon name="tag" size={16} color="#fff" style={{ position: 'absolute', top: 30, left: 36 }} />
              <div style={{ position: 'absolute', bottom: -8, left: 12, right: 12, background: '#fff', borderRadius: 999, padding: '3px', fontSize: 9, textAlign: 'center', border: '1px solid #FF6008' }}>Baby</div>
            </div>
          ))}
        </div>
      </div>
      {/* popular */}
      <div style={{ padding: '24px 12px 8px', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 14, left: 12, background: '#FF6008', color: '#fff', fontSize: 10, padding: '4px 10px', borderRadius: 999, fontWeight: 600 }}>Популярные игрушки</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 14, overflow: 'hidden' }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ flex: '0 0 90px' }}>
              <div style={{ height: 90, background: '#F4F1EB', borderRadius: 6, display: 'grid', placeItems: 'center' }}>
                <Icon name="image" size={14} color="#A8AAB0" />
              </div>
              <div style={{ fontSize: 9, marginTop: 4, fontWeight: 600 }}>Test</div>
              <div style={{ fontSize: 8, color: '#6B6A75' }}>Yerevan</div>
              <div style={{ fontSize: 8, color: '#FF6008', fontWeight: 700, marginTop: 2 }}>$1.00 / day</div>
              <div style={{ fontSize: 7, background: '#FFEEDC', color: '#FF6008', padding: '1px 4px', borderRadius: 4, display: 'inline-block', marginTop: 2 }}>Игрушка</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AuditBoard() {
  return (
    <div style={{ width: 1480, background: '#fff', borderRadius: 12, padding: 32, border: '1px solid #ECE9E2' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', color: '#FF6008', textTransform: 'uppercase' }}>01 · Strategy &amp; Audit</div>
        <h2 style={{ margin: '4px 0 6px', fontSize: 32, fontWeight: 800, color: '#1A1B26', letterSpacing: '-0.02em' }}>
          Evolve, don't reinvent — five fixes that compound
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: '#6B6A75', maxWidth: 800, lineHeight: 1.55 }}>
          ToyRent already works. Architecture, flows and color identity stay. We tighten visual hierarchy, surface trust
          where parents actually look (the card), shrink booking friction, and make every screen survive on a thumb.
        </p>
      </div>

      {/* Two-col: annotated mock | thesis */}
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 32, alignItems: 'start' }}>
        <div style={{ position: 'relative', paddingTop: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6B6A75', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 12 }}>Current — desktop @ 1024 narrow</div>
          <div style={{ position: 'relative' }}>
            <CurrentHomeMini />
            {/* annotations */}
            <Callout num="1" x={210} y={20} side="right" width={170} label="Mixed RU/EN copy; unclear default locale" />
            <Callout num="2" x={130} y={80} side="right" width={170} label="Hero painting fights with content; no trust signals" />
            <Callout num="3" x={20} y={220} side="left" width={170} label="Pill labels overlap cards; visual hierarchy collides" />
            <Callout num="4" x={20} y={360} side="left" width={170} label="Cards show only price + city — no owner, no rating, no age" />
            <Callout num="5" x={250} y={420} side="right" width={130} label="Image placeholders dominate; no fallback strategy" />
          </div>
        </div>

        <div>
          <h3 style={{ margin: '20px 0 14px', fontSize: 18, fontWeight: 700 }}>The five thesis improvements</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            <IssueCard num="1" severity="critical"
              title="Trust is invisible on the card"
              what="Cards show price + city. Owner, hygiene, age range, condition all live one click deeper."
              why="Parents abandon when they can't pre-qualify a listing at a glance. This is the #1 marketplace conversion killer."
              fix="Add owner avatar + name, verified/hygiene icons, age pill on the image. ~6 small atoms, no new screens." />
            <IssueCard num="2" severity="critical"
              title="Booking flow buries the CTA"
              what="Detail page asks for dates inside a card with a peach-disabled button; no sticky CTA, no fees shown until pressed."
              why="Mobile users scroll past the calendar; the button looks disabled even when enabled. Conversion leaks here."
              fix="Sticky bottom bar with price + dates + 'Request to rent'. Date picker opens as bottom-sheet. Price breakdown inline." />
            <IssueCard num="3" severity="high"
              title="Mobile navigation is missing"
              what="Header has Войти / Регистрация only. No tab bar, no bottom CTA for the platform's core action (List a toy)."
              why="Mobile-first product without a thumb-reach nav means users get lost in the catalog and never list supply."
              fix="5-tab bottom nav with prominent center '+' (List a toy). Top header reduced to logo + search + bell." />
            <IssueCard num="4" severity="high"
              title="Image strategy has no fallback"
              what="50%+ of catalog tiles render as a broken 'Изображение отсутствует' grey block."
              why="A toy with no photo is a dead listing. Empty placeholders look like broken marketplace, not 'early days'."
              fix="Generated SVG fallback per category (lego/wooden/plush…) + force min-1-photo on create flow. Lazy load + skeleton." />
            <IssueCard num="5" severity="high"
              title="Create-listing has no shape"
              what="Single long form for parents posting late at night with one hand on a phone."
              why="Listings are the lifeblood of supply. Friction here directly throttles GMV."
              fix="4-step mobile wizard: Photos → Basics → Pricing → Hygiene & rules. Progress bar, auto-save, can resume later." />
            <IssueCard num="6" severity="medium"
              title="Mixed languages on screen"
              what="Header is RU. Body text is RU. Footer is RU. Section titles are EN. Some cards EN, some RU."
              why="Reads as unfinished; erodes the trust the brand is asking parents to extend."
              fix="Lock one language per session via header switcher. Translate all UI strings; i18n key for every label." />
            <IssueCard num="7" severity="medium"
              title="Hero competes with intent"
              what="Painted-texture hero takes 35% of the fold; search bar is small and floats inside it."
              why="Marketplaces convert on browse, not brand. Time-to-first-listing &gt;1s on mobile."
              fix="Compact branded greeting + large search + chips for top categories — toys visible in the first scroll." />
            <IssueCard num="8" severity="medium"
              title="Admin moderation has no triage UI"
              what="Implementation present but no dedicated review queue / approve-reject pattern in design."
              why="Reviewer workload determines time-to-live. A clean queue = faster supply = better marketplace health."
              fix="Mobile-friendly queue with side-by-side photo grid, structured rejection reasons, batch approve." />
          </div>
        </div>
      </div>

      {/* Strategy / KPIs */}
      <div style={{ marginTop: 32, paddingTop: 28, borderTop: '1px solid #ECE9E2' }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 18, fontWeight: 700 }}>North-star metrics this evolution targets</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
          <MetricCard label="Time to first listing" before="3'40&quot;" after="1'15&quot;" />
          <MetricCard label="Listing → booking" before="2.1%" after="6–8%" tone="#0E8A5F" />
          <MetricCard label="Cards with full trust" before="0%" after="100%" tone="#0E8A5F" />
          <MetricCard label="Mobile CTA reachable" before="60%" after="100%" tone="#0E8A5F" />
          <MetricCard label="Moderation cycle" before="~24h" after="&lt;4h" tone="#0E8A5F" />
        </div>
      </div>

      {/* Rollout plan */}
      <div style={{ marginTop: 24, padding: 20, background: '#FAF8F4', borderRadius: 14, border: '1px dashed #ECE9E2' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Icon name="sparkle" size={16} color="#FF6008" />
          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Incremental rollout — works with current Angular + NgRx</h4>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, fontSize: 12, color: '#3A3B47', lineHeight: 1.55 }}>
          <div>
            <div style={{ fontWeight: 700, color: '#1A1B26', marginBottom: 4 }}>Sprint 1 · Tokens &amp; cards</div>
            CSS variable layer, ToyCard component with trust signals, badges, button system. Drop-in for existing pages.
          </div>
          <div>
            <div style={{ fontWeight: 700, color: '#1A1B26', marginBottom: 4 }}>Sprint 2 · Mobile nav &amp; booking</div>
            Bottom tab bar, sticky CTA on detail, date bottom-sheet, pricing breakdown. NgRx booking slice already exists.
          </div>
          <div>
            <div style={{ fontWeight: 700, color: '#1A1B26', marginBottom: 4 }}>Sprint 3 · Create wizard &amp; admin</div>
            4-step create-listing flow with autosave (localStorage). Admin queue with batch approve.
          </div>
          <div>
            <div style={{ fontWeight: 700, color: '#1A1B26', marginBottom: 4 }}>Sprint 4 · Tablet &amp; desktop polish</div>
            Container widening, two-column detail page, sticky desktop sidebar booking. Same components, new layouts.
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { AuditBoard, MetricCard, IssueCard });
