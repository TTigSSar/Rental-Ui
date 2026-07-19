// app.jsx — assemble all sections into the design canvas

const { useState } = React;

function App() {
  // Phone dims for DCArtboard accounting for bezel
  const PH_W = 410, PH_H = 872;
  const DESK_W = 1300, DESK_H = 850;
  const TAB_W = 800, TAB_H = 1064;

  return (
    <DesignCanvas>
      {/* Title / intro */}
      <DCSection id="intro" title="DoRent · Mobile-first Evolution"
        subtitle="An incremental redesign of the existing rental marketplace. Three directions, full flows, ready-to-ship token system. Drag artboards · click a label to rename · ⤢ to focus.">
        <DCArtboard id="cover" label="00 · Cover" width={780} height={420}>
          <CoverCard />
        </DCArtboard>
        <DCArtboard id="legend" label="00 · How to read this" width={420} height={420}>
          <LegendCard />
        </DCArtboard>
      </DCSection>

      {/* 1. Audit */}
      <DCSection id="audit" title="01 · Strategy &amp; Audit"
        subtitle="What's working, what's broken, what we fix and how we measure it.">
        <DCArtboard id="audit-main" label="Audit + thesis + KPIs" width={1480} height={1230}>
          <AuditBoard />
        </DCArtboard>
      </DCSection>

      {/* 2. Foundations */}
      <DCSection id="foundations" title="02 · Foundations"
        subtitle="Tokens, type, spacing and components shared across all three directions.">
        <DCArtboard id="found-main" label="Design system reference" width={1480} height={1640}>
          <FoundationsBoard />
        </DCArtboard>
      </DCSection>

      {/* 3. Three directions side-by-side — HOME */}
      <DCSection id="directions-home" title="03 · Three directions · Home"
        subtitle="Same content, three visual hypotheses. Open any artboard fullscreen to compare seriously.">
        <DCArtboard id="dir-a-home" label="A · Refined Warm" width={PH_W} height={PH_H}>
          <Phone><HomeA /></Phone>
        </DCArtboard>
        <DCArtboard id="dir-b-home" label="B · Soft Family" width={PH_W} height={PH_H}>
          <Phone><HomeB /></Phone>
        </DCArtboard>
        <DCArtboard id="dir-c-home" label="C · Bold Marketplace" width={PH_W} height={PH_H}>
          <Phone><HomeC /></Phone>
        </DCArtboard>
        <DCArtboard id="dir-compare" label="Picking a direction" width={420} height={PH_H}>
          <DirectionCompareCard />
        </DCArtboard>
      </DCSection>

      {/* 4. Three directions — LISTING DETAIL */}
      <DCSection id="directions-listing" title="04 · Three directions · Listing detail"
        subtitle="Sticky CTA + trust signals + clear price hierarchy. Same skeleton, three skins.">
        <DCArtboard id="dir-a-list" label="A · Refined Warm" width={PH_W} height={PH_H}>
          <Phone><ListingScreen dir="A" /></Phone>
        </DCArtboard>
        <DCArtboard id="dir-b-list" label="B · Soft Family" width={PH_W} height={PH_H}>
          <Phone><ListingScreen dir="B" /></Phone>
        </DCArtboard>
        <DCArtboard id="dir-c-list" label="C · Bold Marketplace" width={PH_W} height={PH_H}>
          <Phone><ListingScreen dir="C" /></Phone>
        </DCArtboard>
      </DCSection>

      {/* 5. Three directions — BROWSE */}
      <DCSection id="directions-browse" title="05 · Three directions · Browse"
        subtitle="Same filter model, denser / softer / warmer expression.">
        <DCArtboard id="dir-a-browse" label="A · Refined" width={PH_W} height={PH_H}>
          <Phone><BrowseScreen dir="A" /></Phone>
        </DCArtboard>
        <DCArtboard id="dir-b-browse" label="B · Soft" width={PH_W} height={PH_H}>
          <Phone><BrowseScreen dir="B" /></Phone>
        </DCArtboard>
        <DCArtboard id="dir-c-browse" label="C · Bold" width={PH_W} height={PH_H}>
          <Phone><BrowseScreen dir="C" /></Phone>
        </DCArtboard>
      </DCSection>

      {/* 6. Direction A — full mobile flow */}
      <DCSection id="flow-a" title="06 · Recommended direction · A · Full flow"
        subtitle="The end-to-end mobile journey: discover → detail → book → confirm. Direction A is the conservative evolution; B &amp; C swap the same skeleton.">
        <DCArtboard id="a-flow-home" label="01 · Home" width={PH_W} height={PH_H}>
          <Phone><HomeA /></Phone>
        </DCArtboard>
        <DCArtboard id="a-flow-browse" label="02 · Browse" width={PH_W} height={PH_H}>
          <Phone><BrowseScreen dir="A" /></Phone>
        </DCArtboard>
        <DCArtboard id="a-flow-listing" label="03 · Listing detail" width={PH_W} height={PH_H}>
          <Phone><ListingScreen dir="A" /></Phone>
        </DCArtboard>
        <DCArtboard id="a-flow-booking" label="04 · Date sheet" width={PH_W} height={PH_H}>
          <Phone><BookingScreen dir="A" /></Phone>
        </DCArtboard>
        <DCArtboard id="a-flow-confirm" label="05 · Confirmation" width={PH_W} height={PH_H}>
          <Phone><ConfirmScreen dir="A" /></Phone>
        </DCArtboard>
      </DCSection>

      {/* 7. Auth + create + my toys + admin + empty */}
      <DCSection id="flow-supply" title="07 · Supply &amp; operations flows"
        subtitle="The other half of the marketplace: getting listings up, managing them, and keeping the catalog clean.">
        <DCArtboard id="auth" label="Sign in" width={PH_W} height={PH_H}>
          <Phone><AuthScreen mode="signin" dir="A" /></Phone>
        </DCArtboard>
        <DCArtboard id="create" label="Create — Basics (step 2/4)" width={PH_W} height={PH_H}>
          <Phone><CreateListingStep dir="A" step={1} /></Phone>
        </DCArtboard>
        <DCArtboard id="mytoys" label="My toys" width={PH_W} height={PH_H}>
          <Phone><MyToysScreen dir="A" /></Phone>
        </DCArtboard>
        <DCArtboard id="admin" label="Admin · Review queue" width={PH_W} height={PH_H}>
          <Phone><AdminScreen dir="A" /></Phone>
        </DCArtboard>
        <DCArtboard id="empty" label="Empty states" width={PH_W} height={PH_H}>
          <Phone><EmptyStatesScreen dir="A" /></Phone>
        </DCArtboard>
      </DCSection>

      {/* 8. Tablet */}
      <DCSection id="tablet" title="08 · Tablet (768)"
        subtitle="Same components widening — search joins the header, cards go 3-up, hero gains a side image.">
        <DCArtboard id="tab-home" label="Tablet · Home" width={TAB_W} height={TAB_H}>
          <TabletFrame><TabletHome /></TabletFrame>
        </DCArtboard>
      </DCSection>

      {/* 9. Desktop */}
      <DCSection id="desktop" title="09 · Desktop (1280)"
        subtitle="Tab-bar disappears, sticky booking sidebar appears, gallery becomes a 3+2 grid. Token system unchanged.">
        <DCArtboard id="desk-home" label="Desktop · Home" width={DESK_W} height={DESK_H}>
          <DesktopFrame label="dorent.am"><DesktopHome /></DesktopFrame>
        </DCArtboard>
        <DCArtboard id="desk-listing" label="Desktop · Listing detail" width={DESK_W} height={1200}>
          <DesktopFrame label="dorent.am/toy/lego-duplo-town" h={1180}><DesktopListing /></DesktopFrame>
        </DCArtboard>
      </DCSection>

      {/* 10. Handoff */}
      <DCSection id="handoff" title="10 · Implementation handoff"
        subtitle="Tokens, component map, file structure, agent rules.">
        <DCArtboard id="handoff-main" label="Handoff package" width={1480} height={1660}>
          <HandoffBoard />
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

// ============================================================
// Cover + Legend + Compare cards (canvas-only meta artboards)
// ============================================================
function CoverCard() {
  return (
    <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #FF6008 0%, #FD8B47 60%, #2A2C41 100%)', borderRadius: 16, padding: 32, color: '#fff', position: 'relative', overflow: 'hidden' }}>
      {/* deco blobs */}
      <div style={{ position: 'absolute', top: -60, right: -40, width: 240, height: 240, borderRadius: 999, background: 'rgba(255,255,255,.08)' }} />
      <div style={{ position: 'absolute', bottom: -80, right: 120, width: 180, height: 180, borderRadius: 999, background: 'rgba(255,255,255,.06)' }} />
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'rgba(255,255,255,.15)', backdropFilter: 'blur(8px)', borderRadius: 999, fontSize: 12, fontWeight: 600, marginBottom: 20 }}>
        <Icon name="sparkle" size={14} color="#fff" /> Evolution · not a redesign
      </div>
      <h1 style={{ margin: 0, fontSize: 44, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.05, maxWidth: 560 }}>
        Toy<span style={{ opacity: .8 }}>Rent</span>, mobile-first.
      </h1>
      <p style={{ margin: '16px 0 24px', fontSize: 16, lineHeight: 1.5, maxWidth: 540, opacity: .9 }}>
        A polished iteration of the existing rental marketplace. Same architecture, sharper hierarchy,
        trust visible in every card, and a token system Cursor + Claude Code can follow.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, auto)', gap: 24 }}>
        {[
          { n: '10', l: 'sections' },
          { n: '25', l: 'mobile screens' },
          { n: '3',  l: 'directions' },
          { n: '6',  l: 'core components' },
        ].map((s, i) => (
          <div key={i}>
            <div style={{ fontSize: 36, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em' }}>{s.n}</div>
            <div style={{ fontSize: 12, opacity: .8, marginTop: 4 }}>{s.l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LegendCard() {
  return (
    <div style={{ width: '100%', height: '100%', background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #ECE9E2' }}>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1A1B26' }}>How to read this canvas</h3>
      <p style={{ margin: '6px 0 16px', fontSize: 12, color: '#6B6A75', lineHeight: 1.55 }}>
        Pan with the spacebar, scroll-zoom with Cmd/Ctrl + wheel. Every artboard has a label you can click to rename.
      </p>
      <div style={{ display: 'grid', gap: 10 }}>
        {[
          { n: '01', t: 'Strategy & Audit', d: 'Annotated current state + the 8 issues to fix, prioritized.' },
          { n: '02', t: 'Foundations', d: 'Tokens, type, spacing, components — the design system.' },
          { n: '03–05', t: 'Three directions', d: 'A Refined / B Soft / C Bold across Home, Listing, Browse.' },
          { n: '06', t: 'Recommended flow', d: 'End-to-end mobile journey in Direction A.' },
          { n: '07', t: 'Supply + ops', d: 'Auth, create wizard, owner dashboard, admin queue, empty states.' },
          { n: '08–09', t: 'Tablet / Desktop', d: 'Same tokens, wider containers, sticky sidebars.' },
          { n: '10', t: 'Handoff', d: 'CSS vars, TS tokens, component specs, Cursor rules.' },
        ].map((row, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '50px 1fr', gap: 10, alignItems: 'baseline' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#FF6008', letterSpacing: '.04em', fontFamily: "'JetBrains Mono',monospace" }}>{row.n}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1B26' }}>{row.t}</div>
              <div style={{ fontSize: 11, color: '#6B6A75', lineHeight: 1.45 }}>{row.d}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DirectionCompareCard() {
  return (
    <div style={{ width: '100%', height: '100%', background: '#fff', borderRadius: 16, padding: 22, border: '1px solid #ECE9E2', display: 'flex', flexDirection: 'column' }}>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Which to ship?</h3>
      <p style={{ margin: '4px 0 18px', fontSize: 12, color: '#6B6A75', lineHeight: 1.5 }}>
        All three use the same tokens, components and copy. They differ in personality and density.
      </p>

      {[
        {
          key: 'A', name: 'Refined Warm', tag: 'Recommended',
          tone: '#FF6008',
          when: 'You want to ship soon. Lowest implementation risk — the orange + Inter system already in code stays, components just get tightened and trust signals are added.',
          best: 'Conservative evolution. Existing users barely notice; new users get clarity.'
        },
        {
          key: 'B', name: 'Soft Family', tag: 'Brand-led',
          tone: '#F2620C',
          when: 'You want the warmest, most family-coded surface. Bigger radii, cream backgrounds, colored category tiles.',
          best: 'If the brand is going more into family-warmth and you have time to repaint.'
        },
        {
          key: 'C', name: 'Bold Marketplace', tag: 'Conversion-led',
          tone: '#FF5A1F',
          when: 'You want Avito / OLX energy: dense, fast, price-first. Smaller radii, tighter cards, stronger contrast.',
          best: 'If you discover power-browsers convert 2× and you want to optimize for them.'
        },
      ].map((d, i) => (
        <div key={i} style={{ padding: 14, background: '#FAF8F4', borderRadius: 12, marginBottom: 10, borderLeft: `3px solid ${d.tone}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{d.key} · {d.name}</span>
            <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: d.tone, color: '#fff', textTransform: 'uppercase', letterSpacing: '.04em' }}>{d.tag}</span>
          </div>
          <div style={{ fontSize: 11, color: '#3A3B47', lineHeight: 1.5 }}>{d.when}</div>
          <div style={{ fontSize: 11, color: '#6B6A75', lineHeight: 1.5, marginTop: 6 }}><strong style={{ color: '#1A1B26' }}>Best when:</strong> {d.best}</div>
        </div>
      ))}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
