// mobile-screens.jsx — Three directions × four hero mobile screens

// ============================================================
// Shared: top app bar in mobile (different per direction)
// ============================================================
function TopBar({ dir = 'A', location = 'Yerevan', notif = 2 }) {
  const t = TOKENS[dir];
  return (
    <div style={{
      padding: '12px 16px 10px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: t.surface,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 28, height: 28, background: t.primary, borderRadius: 8, display: 'grid', placeItems: 'center' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-4.5-9.5-9C1 8.7 3.3 5 7 5c2 0 3.5 1 5 3 1.5-2 3-3 5-3 3.7 0 6 3.7 4.5 7-2.5 4.5-9.5 9-9.5 9z"/></svg>
        </div>
        <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.01em', color: t.text }}>
          Toy<span style={{ color: t.primary }}>Rent</span>
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button style={{ height: 32, padding: '0 10px', borderRadius: 999, background: t.surfaceAlt, border: 0,
          display: 'inline-flex', alignItems: 'center', gap: 4, color: t.text, fontWeight: 600, fontSize: 12 }}>
          <Icon name="pin" size={13} color={t.primary} />{location}<Icon name="chevronD" size={12} />
        </button>
        <button style={{ width: 36, height: 36, borderRadius: 999, display: 'grid', placeItems: 'center', background: 'transparent', border: 0, position: 'relative' }}>
          <Icon name="bell" size={20} color={t.text} />
          {notif > 0 && <div style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 999, background: t.primary, boxShadow: `0 0 0 2px ${t.surface}` }} />}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// HOME — Direction A · Refined Warm
// ============================================================
function HomeA() {
  const t = TOKENS.A;
  const cats = [
    { key: 'lego', label: 'LEGO & Bricks', icon: 'grid', color: '#FFE6CC' },
    { key: 'plush', label: 'Plush', icon: 'heart', color: '#FFE0E0' },
    { key: 'wooden', label: 'Wooden', icon: 'home', color: '#E6F2D9' },
    { key: 'bike', label: 'Ride-on', icon: 'truck', color: '#D9E8FF' },
    { key: 'puzzle', label: 'Puzzles', icon: 'sparkle', color: '#F0E6FF' },
    { key: 'board', label: 'Board', icon: 'tag', color: '#FFF1CC' },
  ];
  return (
    <MScreen dir="A">
      <TopBar dir="A" />
      <div style={{ height: 'calc(100% - 56px - 80px)', overflow: 'hidden', paddingBottom: 16 }}>
        {/* Greeting + search */}
        <div style={{ padding: '4px 16px 12px' }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15, color: t.text }}>
            Find a toy your<br/>child will love
          </h1>
          <p style={{ margin: '4px 0 14px', fontSize: 13, color: t.textMute }}>Rent from families nearby in Yerevan.</p>
          <div style={{ height: 48, borderRadius: 14, background: t.surface, border: `1px solid ${t.border}`,
            display: 'flex', alignItems: 'center', padding: '0 14px', gap: 10, boxShadow: t.shadow }}>
            <Icon name="search" size={18} color={t.textMute} />
            <span style={{ flex: 1, fontSize: 14, color: t.textMute }}>Search toys, brands…</span>
            <Icon name="mic" size={18} color={t.textMute} />
          </div>
        </div>

        {/* Categories — horizontal scrolling pills with circular icons */}
        <div style={{ padding: '8px 0 4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 16px 10px' }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: t.text }}>Browse by category</h3>
            <span style={{ fontSize: 12, fontWeight: 600, color: t.primary }}>All →</span>
          </div>
          <div style={{ display: 'flex', gap: 10, overflow: 'hidden', padding: '0 16px', flexWrap: 'nowrap' }}>
            {cats.map(c => (
              <div key={c.key} style={{ flex: '0 0 64px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 64, height: 64, borderRadius: 18, background: c.color,
                  display: 'grid', placeItems: 'center' }}>
                  <Icon name={c.icon} size={26} color={t.text} strokeWidth={2} />
                </div>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: t.text, textAlign: 'center', lineHeight: 1.2 }}>{c.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Popular near you */}
        <SectionTitle dir="A" action="See all">Popular near you</SectionTitle>
        <div style={{ padding: '0 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <ToyCard dir="A" img={TOY_IMGS.lego} title="LEGO Duplo Town Set"
            owner="Anna · Kentron" ownerAv={FAMILY_AVS.anna}
            location="0.4 km" price="₽1,500" age="2–5 yr" verified hygiene />
          <ToyCard dir="A" img={TOY_IMGS.wooden} title="Wooden balance bike"
            owner="David · Aurora" ownerAv={FAMILY_AVS.david}
            location="1.1 km" price="₽800" age="3–6 yr" verified />
        </div>

        {/* Trust strip */}
        <div style={{ margin: '20px 16px 0', padding: 14, background: t.surface, borderRadius: 14, border: `1px solid ${t.border}`,
          display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: t.primarySoft, display: 'grid', placeItems: 'center' }}>
            <Icon name="shield" size={20} color={t.primary} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Every toy is reviewed</div>
            <div style={{ fontSize: 11, color: t.textMute, marginTop: 2, lineHeight: 1.4 }}>Hygiene, photos and condition checked before listings go live.</div>
          </div>
          <Icon name="chevron" size={16} color={t.textMute} />
        </div>
      </div>
      <BottomTabs dir="A" active={0} />
    </MScreen>
  );
}

// ============================================================
// HOME — Direction B · Soft Family
// ============================================================
function HomeB() {
  const t = TOKENS.B;
  const cats = [
    { label: 'LEGO',    img: TOY_IMGS.lego,    color: '#FFE6CC' },
    { label: 'Plush',   img: TOY_IMGS.plush,   color: '#FFD9E0' },
    { label: 'Wooden',  img: TOY_IMGS.wooden,  color: '#DDEDC4' },
    { label: 'Ride-on', img: TOY_IMGS.bike,    color: '#D6E6FF' },
  ];
  return (
    <MScreen dir="B">
      <TopBar dir="B" />
      <div style={{ height: 'calc(100% - 56px - 80px)', overflow: 'hidden', paddingBottom: 16 }}>
        {/* Hero card */}
        <div style={{ margin: '4px 16px 14px', padding: 18, borderRadius: 22, background: 'linear-gradient(135deg, #FFE6CC 0%, #FBE5D6 60%, #F5EAD9 100%)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -10, right: -10, width: 100, height: 100, borderRadius: 999, background: 'rgba(242,98,12,.12)' }} />
          <div style={{ position: 'absolute', bottom: -30, right: 20, width: 70, height: 70, borderRadius: 999, background: 'rgba(91,59,140,.10)' }} />
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', borderRadius: 999, padding: '4px 10px', fontSize: 11, fontWeight: 600, color: t.accent }}>
            <Icon name="sparkle" size={12} color={t.accent} /> Family-trusted rentals
          </div>
          <h1 style={{ margin: '10px 0 4px', fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15, color: t.text }}>
            Less clutter,<br/>more play
          </h1>
          <p style={{ margin: '0 0 14px', fontSize: 13, color: t.textMute, lineHeight: 1.45, maxWidth: 240 }}>
            Borrow gently-loved toys from parents nearby. Return when your child outgrows them.
          </p>
          <div style={{ height: 46, borderRadius: 999, background: '#fff', display: 'flex', alignItems: 'center', padding: '0 6px 0 16px', gap: 10, boxShadow: '0 8px 20px rgba(80,40,10,.10)' }}>
            <Icon name="search" size={18} color={t.textMute} />
            <span style={{ flex: 1, fontSize: 13, color: t.textMute }}>Find a toy…</span>
            <button style={{ height: 34, padding: '0 14px', borderRadius: 999, background: t.primary, color: '#fff', border: 0, fontWeight: 700, fontSize: 12 }}>Search</button>
          </div>
        </div>

        {/* Category cards — 2x2 */}
        <SectionTitle dir="B">Categories</SectionTitle>
        <div style={{ padding: '0 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {cats.map((c, i) => (
            <div key={i} style={{ height: 70, borderRadius: 18, background: c.color, padding: 14, display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden', position: 'relative' }}>
              <img src={c.img} style={{ width: 46, height: 46, borderRadius: 14, objectFit: 'cover', boxShadow: '0 4px 10px rgba(0,0,0,.12)' }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{c.label}</div>
                <div style={{ fontSize: 10, color: t.textMute }}>40+ toys</div>
              </div>
            </div>
          ))}
        </div>

        {/* Popular */}
        <SectionTitle dir="B" action="See all">Popular this week</SectionTitle>
        <div style={{ padding: '0 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <ToyCard dir="B" img={TOY_IMGS.kitchen} title="Wooden play kitchen"
            owner="Marina" ownerAv={FAMILY_AVS.marina}
            location="Davtashen" price="₽1,200" age="3–7 yr" verified hygiene />
          <ToyCard dir="B" img={TOY_IMGS.cars} title="Big-wheel race set"
            owner="Aram" ownerAv={FAMILY_AVS.aram}
            location="Arabkir" price="₽600" age="4–8 yr" verified />
        </div>
      </div>
      <BottomTabs dir="B" active={0} />
    </MScreen>
  );
}

// ============================================================
// HOME — Direction C · Bold Marketplace
// ============================================================
function HomeC() {
  const t = TOKENS.C;
  const cats = ['All', 'LEGO', 'Plush', 'Wooden', 'Ride-on', 'Puzzles', 'Board', 'Sports'];
  return (
    <MScreen dir="C" bg={t.bg}>
      {/* Header — dense, search-led */}
      <div style={{ padding: '10px 12px 8px', background: t.surface }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button style={{ width: 40, height: 40, borderRadius: 10, background: t.surfaceAlt, display: 'grid', placeItems: 'center', border: 0 }}>
            <Icon name="menu" size={20} color={t.text} />
          </button>
          <div style={{ flex: 1, height: 40, borderRadius: 10, background: t.surfaceAlt, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8 }}>
            <Icon name="search" size={16} color={t.textMute} />
            <span style={{ flex: 1, fontSize: 13, color: t.textMute }}>Search toys, brands, owners</span>
          </div>
          <button style={{ width: 40, height: 40, borderRadius: 10, background: t.primary, display: 'grid', placeItems: 'center', border: 0, position: 'relative' }}>
            <Icon name="bell" size={18} color="#fff" />
            <div style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 999, background: '#fff' }} />
          </button>
        </div>
        {/* Location row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 4px 6px' }}>
          <Icon name="pin" size={14} color={t.primary} />
          <span style={{ fontSize: 12, color: t.textMute }}>Deliver / pick up in</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: t.text }}>Yerevan, Kentron</span>
          <Icon name="chevronD" size={12} color={t.textMute} />
        </div>
        {/* Category chips */}
        <div style={{ display: 'flex', gap: 6, overflow: 'hidden', paddingTop: 4 }}>
          {cats.map((c, i) => (
            <span key={i} style={{
              padding: '6px 12px', borderRadius: 8,
              fontSize: 12, fontWeight: 600,
              background: i === 0 ? t.text : t.surfaceAlt,
              color: i === 0 ? '#fff' : t.text,
              whiteSpace: 'nowrap',
            }}>{c}</span>
          ))}
        </div>
      </div>

      <div style={{ height: 'calc(100% - 56px - 152px)', overflow: 'hidden', padding: '12px 12px 0' }}>
        {/* Promo banner */}
        <div style={{
          height: 96, borderRadius: 12, marginBottom: 14, padding: 14,
          background: `linear-gradient(95deg, ${t.accent}, #2c3a4f)`,
          color: '#fff', display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ width: 56, height: 56, borderRadius: 10, background: 'rgba(255,255,255,.14)', display: 'grid', placeItems: 'center' }}>
            <Icon name="sparkle" size={26} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>First rental −20%</div>
            <div style={{ fontSize: 11, opacity: .8, marginTop: 2, lineHeight: 1.4 }}>Use code <strong>HELLO</strong> on any toy under ₽2,000.</div>
          </div>
          <Icon name="chevron" size={16} color="#fff" />
        </div>

        {/* Result count + sort */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>318 toys near you</span>
          <button style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'transparent', border: 0, fontSize: 12, color: t.textMute, fontWeight: 600 }}>
            Sort: Closest <Icon name="chevronD" size={12} color={t.textMute} />
          </button>
        </div>

        {/* Dense grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <ToyCard dir="C" img={TOY_IMGS.lego} title="LEGO Duplo Town" owner="Anna · 0.4km" ownerAv={FAMILY_AVS.anna} location="Kentron" price="₽1,500" age="2–5y" verified hygiene size="sm" />
          <ToyCard dir="C" img={TOY_IMGS.wooden} title="Wooden bike" owner="David · 1.1km" ownerAv={FAMILY_AVS.david} location="Aurora" price="₽800" age="3–6y" verified size="sm" />
          <ToyCard dir="C" img={TOY_IMGS.kitchen} title="Play kitchen" owner="Marina · 2.3km" ownerAv={FAMILY_AVS.marina} location="Davtashen" price="₽1,200" age="3–7y" verified hygiene size="sm" />
          <ToyCard dir="C" img={TOY_IMGS.plush} title="Plush family pack" owner="Aram · 0.8km" ownerAv={FAMILY_AVS.aram} location="Center" price="₽400" age="0–3y" hygiene size="sm" />
        </div>
      </div>
      <BottomTabs dir="C" active={0} />
    </MScreen>
  );
}

// ============================================================
// BROWSE / SEARCH — single shared layout, themable by direction
// ============================================================
function BrowseScreen({ dir = 'A' }) {
  const t = TOKENS[dir];
  return (
    <MScreen dir={dir}>
      <div style={{ padding: '12px 16px 8px', background: t.surface, borderBottom: `1px solid ${t.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button style={{ width: 40, height: 40, borderRadius: 999, background: 'transparent', display: 'grid', placeItems: 'center', border: 0 }}>
            <Icon name="chevronL" size={20} color={t.text} />
          </button>
          <div style={{ flex: 1, height: 40, borderRadius: 12, background: t.surfaceAlt, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8 }}>
            <Icon name="search" size={16} color={t.textMute} />
            <span style={{ flex: 1, fontSize: 13, color: t.text, fontWeight: 500 }}>LEGO</span>
            <Icon name="x" size={14} color={t.textMute} />
          </div>
          <button style={{ width: 40, height: 40, borderRadius: 12, background: t.primary, display: 'grid', placeItems: 'center', border: 0, position: 'relative' }}>
            <Icon name="filter" size={18} color="#fff" />
            <div style={{ position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999, background: t.text, color: '#fff', fontSize: 9, fontWeight: 700, display: 'grid', placeItems: 'center', border: `1.5px solid ${t.surface}` }}>3</div>
          </button>
        </div>
        {/* Active filters */}
        <div style={{ display: 'flex', gap: 6, overflow: 'hidden', paddingTop: 12 }}>
          <span style={{ padding: '6px 12px', borderRadius: t.radiusPill, fontSize: 11, fontWeight: 600, background: t.primarySoft, color: t.primary, display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>2–5 yrs <Icon name="x" size={10} color={t.primary} /></span>
          <span style={{ padding: '6px 12px', borderRadius: t.radiusPill, fontSize: 11, fontWeight: 600, background: t.primarySoft, color: t.primary, display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>Under ₽2,000 <Icon name="x" size={10} color={t.primary} /></span>
          <span style={{ padding: '6px 12px', borderRadius: t.radiusPill, fontSize: 11, fontWeight: 600, background: t.primarySoft, color: t.primary, display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>Verified only <Icon name="x" size={10} color={t.primary} /></span>
        </div>
      </div>
      <div style={{ padding: '14px 16px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: t.textMute }}><strong style={{ color: t.text }}>32 toys</strong> · within 3 km</span>
        <button style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'transparent', border: 0, fontSize: 12, color: t.text, fontWeight: 600 }}>
          Closest first <Icon name="chevronD" size={12} color={t.text} />
        </button>
      </div>
      <div style={{ padding: '0 16px', overflow: 'hidden', height: 'calc(100% - 56px - 144px - 80px)', paddingBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <ToyCard dir={dir} img={TOY_IMGS.lego} title="LEGO Duplo Town" owner="Anna · 0.4 km" ownerAv={FAMILY_AVS.anna} location="Kentron" price="₽1,500" age="2–5 yr" verified hygiene />
          <ToyCard dir={dir} img={TOY_IMGS.blocks} title="LEGO Classic 484pcs" owner="Mira · 1.0 km" ownerAv={FAMILY_AVS.marina} location="Arabkir" price="₽1,200" age="4–8 yr" verified />
          <ToyCard dir={dir} img={TOY_IMGS.cars} title="LEGO City vehicles" owner="Aram · 1.8 km" ownerAv={FAMILY_AVS.aram} location="Davtashen" price="₽900" age="4–8 yr" hygiene />
          <ToyCard dir={dir} img={TOY_IMGS.baby} title="LEGO Duplo Animals" owner="David · 2.3 km" ownerAv={FAMILY_AVS.david} location="Aurora" price="₽700" age="1–3 yr" verified hygiene />
        </div>
      </div>
      <BottomTabs dir={dir} active={1} />
    </MScreen>
  );
}

// ============================================================
// LISTING DETAIL — themable, sticky CTA at bottom
// ============================================================
function ListingScreen({ dir = 'A' }) {
  const t = TOKENS[dir];
  return (
    <MScreen dir={dir}>
      {/* Floating back/heart over image */}
      <div style={{ position: 'absolute', top: 14, left: 12, right: 12, display: 'flex', justifyContent: 'space-between', zIndex: 5 }}>
        <button style={{ width: 40, height: 40, borderRadius: 999, background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(8px)', display: 'grid', placeItems: 'center', border: 0 }}>
          <Icon name="chevronL" size={20} color={t.text} />
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ width: 40, height: 40, borderRadius: 999, background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(8px)', display: 'grid', placeItems: 'center', border: 0 }}>
            <Icon name="heart" size={18} color={t.text} />
          </button>
          <button style={{ width: 40, height: 40, borderRadius: 999, background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(8px)', display: 'grid', placeItems: 'center', border: 0 }}>
            <Icon name="arrow" size={18} color={t.text} />
          </button>
        </div>
      </div>

      <div style={{ height: 'calc(100% - 80px)', overflow: 'hidden' }}>
        {/* Image */}
        <div style={{ height: 280, background: t.surfaceAlt, position: 'relative' }}>
          <img src={TOY_IMGS.lego} alt="LEGO" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', bottom: 12, right: 12, padding: '4px 10px', background: 'rgba(15,17,21,.7)', backdropFilter: 'blur(8px)', borderRadius: 999, fontSize: 11, color: '#fff', fontWeight: 600 }}>1 / 5</div>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 16px 100px', background: t.bg }}>
          {/* Title block */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
            <Badge tone="success" dir={dir}><Icon name="verified" size={11} color={t.success} /> Verified</Badge>
            <Badge tone="info" dir={dir}><Icon name="clean" size={11} /> Hygiene checked</Badge>
            <Badge tone="default" dir={dir}>2–5 yr</Badge>
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: t.text, letterSpacing: '-0.01em', lineHeight: 1.2 }}>LEGO Duplo Town Set — 124 pcs</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 12, color: t.textMute }}>
            <Icon name="pin" size={12} color={t.textMute} /> Kentron · 0.4 km away
            <span style={{ width: 3, height: 3, background: t.textMute, borderRadius: 999 }} />
            <Icon name="star" size={12} color="#F2A900" /> <strong style={{ color: t.text }}>4.9</strong> (24)
          </div>

          {/* Owner card */}
          <div style={{ marginTop: 14, padding: 12, background: t.surface, borderRadius: t.radiusCard, border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src={FAMILY_AVS.anna} style={{ width: 44, height: 44, borderRadius: 999, objectFit: 'cover' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.text, display: 'flex', alignItems: 'center', gap: 4 }}>
                Anna Sargsyan <Icon name="verified" size={13} color={t.success} />
              </div>
              <div style={{ fontSize: 11, color: t.textMute }}>12 toys · responds in &lt; 2h · since 2024</div>
            </div>
            <button style={{ width: 40, height: 40, borderRadius: 999, background: t.surfaceAlt, display: 'grid', placeItems: 'center', border: 0 }}>
              <Icon name="message" size={18} color={t.text} />
            </button>
          </div>

          {/* Description */}
          <h3 style={{ margin: '18px 0 6px', fontSize: 14, fontWeight: 700, color: t.text }}>About this toy</h3>
          <p style={{ margin: 0, fontSize: 13, color: t.textMute, lineHeight: 1.55 }}>
            Gently-used set, all pieces accounted for. Recently sanitized. Includes 3 mini-figures, a vehicle and a track.
            Perfect for ages 2 to 5.
          </p>

          {/* Pickup options */}
          <h3 style={{ margin: '18px 0 8px', fontSize: 14, fontWeight: 700, color: t.text }}>Pickup &amp; return</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ padding: 12, borderRadius: t.radius, background: t.surface, border: `1.5px solid ${t.primary}`, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: t.primarySoft, display: 'grid', placeItems: 'center' }}>
                <Icon name="pin" size={18} color={t.primary} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Pickup near Kentron metro</div>
                <div style={{ fontSize: 11, color: t.textMute }}>Free · weekdays 18–21h, weekends 10–14h</div>
              </div>
              <div style={{ width: 20, height: 20, borderRadius: 999, border: `2px solid ${t.primary}`, display: 'grid', placeItems: 'center' }}>
                <div style={{ width: 10, height: 10, borderRadius: 999, background: t.primary }} />
              </div>
            </div>
            <div style={{ padding: 12, borderRadius: t.radius, background: t.surface, border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: t.surfaceAlt, display: 'grid', placeItems: 'center' }}>
                <Icon name="truck" size={18} color={t.textMute} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Courier delivery</div>
                <div style={{ fontSize: 11, color: t.textMute }}>+ ₽600 · same-day in Yerevan</div>
              </div>
              <div style={{ width: 20, height: 20, borderRadius: 999, border: `2px solid ${t.border}` }} />
            </div>
          </div>

          {/* Trust grid */}
          <h3 style={{ margin: '18px 0 8px', fontSize: 14, fontWeight: 700, color: t.text }}>Safety &amp; care</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { icon: 'clean', label: 'Sanitized between rentals' },
              { icon: 'shield', label: 'Refundable deposit ₽1,000' },
              { icon: 'check', label: 'Owner ID verified' },
              { icon: 'flag', label: 'Cancel free up to 24h' },
            ].map((x, i) => (
              <div key={i} style={{ padding: 10, background: t.surface, borderRadius: t.radius, border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name={x.icon} size={16} color={t.success} />
                <span style={{ fontSize: 11, fontWeight: 600, color: t.text }}>{x.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sticky bottom CTA */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: t.surface, borderTop: `1px solid ${t.border}`, padding: '12px 16px 28px', display: 'flex', gap: 10, alignItems: 'center', boxShadow: '0 -8px 24px rgba(0,0,0,.06)' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: t.text }}>₽1,500</span>
            <span style={{ fontSize: 12, color: t.textMute }}>/ day</span>
          </div>
          <div style={{ fontSize: 11, color: t.textMute, marginTop: 2 }}>Tap to pick dates →</div>
        </div>
        <Btn dir={dir} size="lg" variant="primary">Request to rent</Btn>
      </div>
    </MScreen>
  );
}

// ============================================================
// BOOKING BOTTOM SHEET — themable
// ============================================================
function BookingScreen({ dir = 'A' }) {
  const t = TOKENS[dir];
  // mini cal: highlight 18–22 May
  const days = Array.from({ length: 30 }, (_, i) => i + 1);
  return (
    <MScreen dir={dir} bg="rgba(15,17,21,.4)">
      {/* dim backdrop content shadow */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,17,21,.4)' }} />
      {/* Sheet */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        background: t.surface, borderRadius: '24px 24px 0 0',
        padding: '12px 16px 24px',
        height: '88%',
        boxShadow: '0 -20px 40px rgba(0,0,0,.2)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ width: 36, height: 4, background: t.border, borderRadius: 4, margin: '0 auto 12px' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: t.text }}>Pick rental dates</h2>
          <button style={{ width: 32, height: 32, borderRadius: 999, background: t.surfaceAlt, display: 'grid', placeItems: 'center', border: 0 }}>
            <Icon name="x" size={16} color={t.text} />
          </button>
        </div>

        {/* Calendar mini */}
        <div style={{ padding: 12, background: t.bg, borderRadius: t.radiusCard, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <button style={{ width: 28, height: 28, display: 'grid', placeItems: 'center', borderRadius: 999, background: t.surface, border: 0 }}>
              <Icon name="chevronL" size={14} color={t.text} />
            </button>
            <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>May 2026</span>
            <button style={{ width: 28, height: 28, display: 'grid', placeItems: 'center', borderRadius: 999, background: t.surface, border: 0 }}>
              <Icon name="chevron" size={14} color={t.text} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
            {['M','T','W','T','F','S','S'].map((d, i) => (
              <div key={i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: t.textMute, padding: '4px 0' }}>{d}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {days.map(d => {
              const selected = d >= 18 && d <= 22;
              const start = d === 18;
              const end = d === 22;
              const middle = d > 18 && d < 22;
              return (
                <div key={d} style={{
                  height: 32, display: 'grid', placeItems: 'center',
                  fontSize: 12, fontWeight: 600,
                  color: selected ? '#fff' : t.text,
                  background: selected ? (middle ? `${t.primary}55` : t.primary) : 'transparent',
                  borderRadius: start ? `${t.radiusPill}px 0 0 ${t.radiusPill}px` : end ? `0 ${t.radiusPill}px ${t.radiusPill}px 0` : middle ? 0 : 999,
                }}>{d}</div>
              );
            })}
          </div>
        </div>

        {/* Selected dates summary */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1, padding: 12, borderRadius: t.radius, background: t.bg, border: `1.5px solid ${t.primary}` }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: t.textMute, letterSpacing: '.04em', textTransform: 'uppercase' }}>Pickup</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginTop: 2 }}>Mon 18 May</div>
          </div>
          <div style={{ flex: 1, padding: 12, borderRadius: t.radius, background: t.bg, border: `1.5px solid ${t.border}` }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: t.textMute, letterSpacing: '.04em', textTransform: 'uppercase' }}>Return</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginTop: 2 }}>Fri 22 May</div>
          </div>
        </div>

        {/* Price breakdown */}
        <div style={{ background: t.bg, borderRadius: t.radiusCard, padding: 14, marginBottom: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: t.textMute, marginBottom: 6 }}>
            <span>₽1,500 × 4 days</span><span style={{ color: t.text, fontWeight: 600 }}>₽6,000</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: t.textMute, marginBottom: 6 }}>
            <span>Service fee</span><span style={{ color: t.text, fontWeight: 600 }}>₽300</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: t.textMute, marginBottom: 10 }}>
            <span>Refundable deposit</span><span style={{ color: t.text, fontWeight: 600 }}>₽1,000</span>
          </div>
          <div style={{ height: 1, background: t.border, margin: '8px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Total today</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: t.text, letterSpacing: '-0.01em' }}>₽7,300</span>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <Btn dir={dir} variant="primary" size="lg" full>Send request to Anna</Btn>
          <div style={{ fontSize: 11, color: t.textMute, marginTop: 8, textAlign: 'center' }}>
            <Icon name="lock" size={11} color={t.textMute} /> You won't be charged until Anna confirms.
          </div>
        </div>
      </div>
    </MScreen>
  );
}

Object.assign(window, {
  TopBar, HomeA, HomeB, HomeC,
  BrowseScreen, ListingScreen, BookingScreen,
});
