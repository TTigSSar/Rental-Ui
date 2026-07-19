// responsive.jsx — Tablet + Desktop adaptations of key screens

// =====================================================
// DESKTOP — Home (1280 wide)
// =====================================================
function DesktopHome() {
  const t = TOKENS.A;
  return (
    <div className="mk" style={{ width: '100%', height: '100%', background: t.bg, overflow: 'hidden', position: 'relative' }}>
      {/* Web header */}
      <header style={{
        height: 68, background: t.surface, borderBottom: `1px solid ${t.border}`,
        padding: '0 32px', display: 'flex', alignItems: 'center', gap: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 32, height: 32, background: t.primary, borderRadius: 9, display: 'grid', placeItems: 'center' }}>
            <Icon name="heart" size={18} color="#fff" />
          </div>
          <span style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.01em' }}>
            Toy<span style={{ color: t.primary }}>Rent</span>
          </span>
        </div>
        <div style={{ flex: 1, maxWidth: 480, height: 44, borderRadius: 12, background: t.bg, border: `1px solid ${t.border}`,
          display: 'flex', alignItems: 'center', padding: '0 14px', gap: 10 }}>
          <Icon name="search" size={18} color={t.textMute} />
          <span style={{ flex: 1, fontSize: 14, color: t.textMute }}>Search toys, brands, owners…</span>
          <button style={{ height: 32, padding: '0 14px', borderRadius: 999, background: t.primary, color: '#fff', border: 0, fontSize: 13, fontWeight: 700 }}>Search</button>
        </div>
        <button style={{ height: 40, padding: '0 14px', borderRadius: 999, background: 'transparent', border: 0, color: t.text, fontWeight: 600, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Icon name="pin" size={14} color={t.primary} /> Yerevan
        </button>
        <Btn dir="A" variant="secondary" size="md" icon="plus">List a toy</Btn>
        <button style={{ width: 40, height: 40, borderRadius: 999, background: 'transparent', display: 'grid', placeItems: 'center', border: 0 }}>
          <Icon name="bell" size={18} color={t.text} />
        </button>
        <img src={FAMILY_AVS.anna} style={{ width: 36, height: 36, borderRadius: 999 }} />
      </header>

      {/* Hero band */}
      <div style={{ padding: '40px 80px 32px', background: `linear-gradient(180deg, ${t.bg}, ${t.surface})` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: t.primarySoft, borderRadius: 999, fontSize: 12, fontWeight: 700, color: t.primary, marginBottom: 16 }}>
              <Icon name="sparkle" size={13} color={t.primary} /> Family-trusted rentals · Yerevan
            </div>
            <h1 style={{ margin: 0, fontSize: 48, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.05, color: t.text }}>
              The joy of new toys,<br/>without the clutter.
            </h1>
            <p style={{ margin: '14px 0 24px', fontSize: 16, color: t.textMute, lineHeight: 1.5, maxWidth: 460 }}>
              Rent quality toys from verified families in your neighborhood. Less waste, more play, every week.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <Btn dir="A" variant="primary" size="lg">Browse toys nearby</Btn>
              <Btn dir="A" variant="secondary" size="lg" icon="plus">List your first toy</Btn>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 28 }}>
              <div style={{ display: 'flex', marginLeft: 0 }}>
                {[FAMILY_AVS.anna, FAMILY_AVS.david, FAMILY_AVS.marina, FAMILY_AVS.aram].map((a, i) => (
                  <img key={i} src={a} style={{ width: 32, height: 32, borderRadius: 999, marginLeft: i ? -10 : 0, border: '2px solid #fff', objectFit: 'cover' }} />
                ))}
              </div>
              <div style={{ fontSize: 12, color: t.textMute, lineHeight: 1.4 }}>
                <strong style={{ color: t.text }}>3,200+ families</strong> · 1,400 toys listed this month
              </div>
            </div>
          </div>
          {/* Featured hero card */}
          <div style={{ width: 380, padding: 18, background: t.surface, borderRadius: 22, boxShadow: t.shadow, border: `1px solid ${t.border}` }}>
            <img src={TOY_IMGS.lego} style={{ width: '100%', height: 200, objectFit: 'cover', borderRadius: 14 }} />
            <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
              <Badge tone="success" dir="A"><Icon name="verified" size={11} color={t.success}/> Verified</Badge>
              <Badge tone="info" dir="A"><Icon name="clean" size={11}/> Hygiene</Badge>
              <Badge tone="default" dir="A">2–5 yr</Badge>
            </div>
            <h3 style={{ margin: '10px 0 4px', fontSize: 18, fontWeight: 700 }}>LEGO Duplo Town Set — 124 pcs</h3>
            <div style={{ fontSize: 12, color: t.textMute, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="pin" size={12} color={t.textMute} /> Kentron · 0.4 km · ★ 4.9 (24)
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 14, borderTop: `1px solid ${t.border}` }}>
              <div>
                <span style={{ fontSize: 22, fontWeight: 800, color: t.primary }}>₽1,500</span>
                <span style={{ fontSize: 13, color: t.textMute, marginLeft: 4 }}>/ day</span>
              </div>
              <Btn dir="A" variant="primary" size="md">View toy</Btn>
            </div>
          </div>
        </div>
      </div>

      {/* Categories strip */}
      <div style={{ padding: '0 80px 24px' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 22, fontWeight: 800, color: t.text, letterSpacing: '-0.01em' }}>Browse by category</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
          {[
            { l: 'LEGO',   c: '#FFE6CC', i: 'grid' },
            { l: 'Plush',  c: '#FFE0E0', i: 'heart' },
            { l: 'Wooden', c: '#E6F2D9', i: 'home' },
            { l: 'Ride-on',c: '#D9E8FF', i: 'truck' },
            { l: 'Puzzles',c: '#F0E6FF', i: 'sparkle' },
            { l: 'Board',  c: '#FFF1CC', i: 'tag' },
          ].map((c, i) => (
            <div key={i} style={{ background: t.surface, borderRadius: 16, padding: 16, border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: c.c, display: 'grid', placeItems: 'center' }}>
                <Icon name={c.i} size={22} color={t.text} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{c.l}</div>
                <div style={{ fontSize: 11, color: t.textMute }}>40+ toys</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Featured grid */}
      <div style={{ padding: '0 80px 40px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: t.text, letterSpacing: '-0.01em' }}>Popular this week</h3>
          <span style={{ fontSize: 13, color: t.primary, fontWeight: 700 }}>See all 318 →</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <ToyCard dir="A" img={TOY_IMGS.wooden} title="Wooden balance bike" owner="David · Aurora" ownerAv={FAMILY_AVS.david} location="1.1 km" price="₽800" age="3–6 yr" verified />
          <ToyCard dir="A" img={TOY_IMGS.kitchen} title="Wooden play kitchen" owner="Marina · Davtashen" ownerAv={FAMILY_AVS.marina} location="2.3 km" price="₽1,200" age="3–7 yr" verified hygiene />
          <ToyCard dir="A" img={TOY_IMGS.plush} title="Plush family pack" owner="Aram · Center" ownerAv={FAMILY_AVS.aram} location="0.8 km" price="₽400" age="0–3 yr" hygiene />
          <ToyCard dir="A" img={TOY_IMGS.cars} title="Big-wheel race set" owner="Anna · Kentron" ownerAv={FAMILY_AVS.anna} location="0.4 km" price="₽600" age="4–8 yr" verified hygiene />
        </div>
      </div>
    </div>
  );
}

// =====================================================
// DESKTOP — Listing detail (2-col, sticky booking)
// =====================================================
function DesktopListing() {
  const t = TOKENS.A;
  return (
    <div className="mk" style={{ width: '100%', height: '100%', background: t.bg, overflow: 'hidden', position: 'relative' }}>
      {/* Compressed header */}
      <header style={{
        height: 60, background: t.surface, borderBottom: `1px solid ${t.border}`,
        padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, background: t.primary, borderRadius: 8, display: 'grid', placeItems: 'center' }}>
            <Icon name="heart" size={16} color="#fff" />
          </div>
          <span style={{ fontSize: 17, fontWeight: 800 }}>Toy<span style={{ color: t.primary }}>Rent</span></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: t.textMute }}>
          Home <Icon name="chevron" size={11}/> Toys <Icon name="chevron" size={11}/> <span style={{ color: t.text, fontWeight: 600 }}>LEGO Duplo Town</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Btn dir="A" variant="secondary" size="sm" icon="heart">Save</Btn>
          <img src={FAMILY_AVS.anna} style={{ width: 32, height: 32, borderRadius: 999 }} />
        </div>
      </header>

      <div style={{ padding: '24px 80px', display: 'grid', gridTemplateColumns: '1fr 380px', gap: 32 }}>
        {/* Left: gallery + content */}
        <div>
          {/* Gallery */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 6, height: 420, marginBottom: 24 }}>
            <img src={TOY_IMGS.lego} style={{ width: '100%', height: '100%', objectFit: 'cover', gridRow: '1 / 3', borderRadius: '14px 0 0 14px' }} />
            <img src={TOY_IMGS.blocks} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <img src={TOY_IMGS.cars} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '0 14px 0 0' }} />
            <img src={TOY_IMGS.baby} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'relative' }}>
              <img src={TOY_IMGS.plush} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '0 0 14px 0' }} />
              <button style={{ position: 'absolute', bottom: 12, right: 12, height: 32, padding: '0 12px', borderRadius: 999, background: 'rgba(255,255,255,.95)', border: 0, fontSize: 12, fontWeight: 600, color: t.text, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Icon name="image" size={12}/> All 5 photos
              </button>
            </div>
          </div>

          {/* Title block */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <Badge tone="success" dir="A"><Icon name="verified" size={11} color={t.success}/> Verified owner</Badge>
            <Badge tone="info" dir="A"><Icon name="clean" size={11}/> Hygiene checked</Badge>
            <Badge tone="default" dir="A">Age 2–5</Badge>
            <Badge tone="primary" dir="A">★ 4.9 · 24 reviews</Badge>
          </div>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, color: t.text, letterSpacing: '-0.02em' }}>LEGO Duplo Town Set — 124 pcs</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, fontSize: 14, color: t.textMute }}>
            <Icon name="pin" size={14} color={t.textMute}/> Kentron, Yerevan · 0.4 km from you
          </div>

          {/* Owner / Description block */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 24 }}>
            <div style={{ padding: 18, background: t.surface, borderRadius: 16, border: `1px solid ${t.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <img src={FAMILY_AVS.anna} style={{ width: 48, height: 48, borderRadius: 999 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                    Anna Sargsyan <Icon name="verified" size={14} color={t.success}/>
                  </div>
                  <div style={{ fontSize: 12, color: t.textMute }}>Owner · 12 toys · since 2024</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 14 }}>
                <div style={{ textAlign: 'center', padding: 8, background: t.bg, borderRadius: 10 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: t.text }}>4.9</div>
                  <div style={{ fontSize: 10, color: t.textMute }}>Rating</div>
                </div>
                <div style={{ textAlign: 'center', padding: 8, background: t.bg, borderRadius: 10 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: t.text }}>98%</div>
                  <div style={{ fontSize: 10, color: t.textMute }}>Reply rate</div>
                </div>
                <div style={{ textAlign: 'center', padding: 8, background: t.bg, borderRadius: 10 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: t.text }}>&lt;2h</div>
                  <div style={{ fontSize: 10, color: t.textMute }}>Replies in</div>
                </div>
              </div>
            </div>
            <div style={{ padding: 18, background: t.surface, borderRadius: 16, border: `1px solid ${t.border}` }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700 }}>About this toy</h4>
              <p style={{ margin: 0, fontSize: 13, color: t.textMute, lineHeight: 1.55 }}>
                Gently-used set, all 124 pieces accounted for. Recently sanitized.
                Includes 3 mini-figures, a vehicle and a track. Perfect for ages 2 to 5.
              </p>
            </div>
          </div>

          {/* Trust + pickup grid */}
          <h3 style={{ margin: '28px 0 12px', fontSize: 18, fontWeight: 700 }}>Pickup, safety &amp; deposit</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {[
              { icon: 'pin',    title: 'Pickup near Kentron metro', sub: 'Free' },
              { icon: 'truck',  title: 'Courier delivery', sub: '+ ₽600' },
              { icon: 'clean',  title: 'Sanitized between rentals', sub: 'Verified' },
              { icon: 'shield', title: 'Refundable deposit', sub: '₽1,000' },
            ].map((x, i) => (
              <div key={i} style={{ padding: 14, background: t.surface, borderRadius: 12, border: `1px solid ${t.border}` }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: t.primarySoft, display: 'grid', placeItems: 'center', marginBottom: 10 }}>
                  <Icon name={x.icon} size={18} color={t.primary} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{x.title}</div>
                <div style={{ fontSize: 11, color: t.textMute, marginTop: 2 }}>{x.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: sticky booking */}
        <div style={{ position: 'sticky', top: 24, alignSelf: 'start' }}>
          <div style={{ padding: 20, background: t.surface, borderRadius: 18, border: `1px solid ${t.border}`, boxShadow: t.shadow }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: t.text, letterSpacing: '-0.02em' }}>₽1,500</span>
              <span style={{ fontSize: 14, color: t.textMute }}>/ day</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 14, padding: 4, background: t.bg, borderRadius: 12 }}>
              <div style={{ padding: 10, background: t.surface, borderRadius: 10, border: `1.5px solid ${t.primary}` }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: t.textMute, letterSpacing: '.04em', textTransform: 'uppercase' }}>Pickup</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Mon 18 May</div>
              </div>
              <div style={{ padding: 10, background: t.surface, borderRadius: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: t.textMute, letterSpacing: '.04em', textTransform: 'uppercase' }}>Return</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Fri 22 May</div>
              </div>
            </div>
            <div style={{ display: 'grid', gap: 6, marginTop: 14, fontSize: 13, color: t.textMute }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>₽1,500 × 4 days</span><span style={{ color: t.text, fontWeight: 600 }}>₽6,000</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Service fee</span><span style={{ color: t.text, fontWeight: 600 }}>₽300</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Refundable deposit</span><span style={{ color: t.text, fontWeight: 600 }}>₽1,000</span>
              </div>
              <div style={{ height: 1, background: t.border, margin: '6px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontWeight: 700, color: t.text }}>Total</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: t.text }}>₽7,300</span>
              </div>
            </div>
            <Btn dir="A" variant="primary" size="lg" full style={{ marginTop: 16 }}>Request to rent</Btn>
            <div style={{ fontSize: 11, color: t.textMute, marginTop: 10, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <Icon name="lock" size={11} color={t.textMute}/> You won't be charged until Anna confirms.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// TABLET — Home (768 wide)
// =====================================================
function TabletHome() {
  const t = TOKENS.A;
  return (
    <div className="mk" style={{ width: '100%', height: '100%', background: t.bg, overflow: 'hidden', position: 'relative' }}>
      <header style={{
        height: 60, padding: '0 24px', background: t.surface, borderBottom: `1px solid ${t.border}`,
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, background: t.primary, borderRadius: 8, display: 'grid', placeItems: 'center' }}><Icon name="heart" size={16} color="#fff"/></div>
          <span style={{ fontSize: 17, fontWeight: 800 }}>Toy<span style={{ color: t.primary }}>Rent</span></span>
        </div>
        <div style={{ flex: 1, height: 40, borderRadius: 12, background: t.bg, border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8 }}>
          <Icon name="search" size={16} color={t.textMute} />
          <span style={{ flex: 1, fontSize: 13, color: t.textMute }}>Search toys, brands…</span>
        </div>
        <Btn dir="A" variant="primary" size="sm" icon="plus">List</Btn>
        <img src={FAMILY_AVS.anna} style={{ width: 32, height: 32, borderRadius: 999 }} />
      </header>

      <div style={{ padding: '24px' }}>
        <div style={{ padding: 24, borderRadius: 20, background: `linear-gradient(135deg, ${t.primarySoft}, ${t.surface})`, marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
            Less clutter, more play.
          </h1>
          <p style={{ margin: '6px 0 16px', fontSize: 14, color: t.textMute }}>Rent quality toys from families in Yerevan.</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn dir="A" variant="primary" size="md">Browse toys</Btn>
            <Btn dir="A" variant="secondary" size="md" icon="plus">List a toy</Btn>
          </div>
        </div>

        <h3 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 700 }}>Categories</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 24 }}>
          {[{l:'LEGO', c:'#FFE6CC'}, {l:'Plush', c:'#FFE0E0'}, {l:'Wooden', c:'#E6F2D9'}, {l:'Ride-on', c:'#D9E8FF'}].map((c, i) => (
            <div key={i} style={{ height: 70, borderRadius: 14, background: c.c, padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#fff', display: 'grid', placeItems: 'center' }}>
                <Icon name="grid" size={20} color={t.text} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{c.l}</div>
                <div style={{ fontSize: 11, color: t.textMute }}>40+ toys</div>
              </div>
            </div>
          ))}
        </div>

        <h3 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 700 }}>Popular this week</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          <ToyCard dir="A" img={TOY_IMGS.lego} title="LEGO Duplo Town" owner="Anna · Kentron" ownerAv={FAMILY_AVS.anna} location="0.4 km" price="₽1,500" age="2–5 yr" verified hygiene />
          <ToyCard dir="A" img={TOY_IMGS.wooden} title="Wooden balance bike" owner="David · Aurora" ownerAv={FAMILY_AVS.david} location="1.1 km" price="₽800" age="3–6 yr" verified />
          <ToyCard dir="A" img={TOY_IMGS.kitchen} title="Wooden play kitchen" owner="Marina · Davtashen" ownerAv={FAMILY_AVS.marina} location="2.3 km" price="₽1,200" age="3–7 yr" verified hygiene />
        </div>
      </div>
    </div>
  );
}

// =====================================================
// Wrapped device frames
// =====================================================
function DesktopFrame({ children, w = 1280, h = 800, label }) {
  return (
    <div style={{
      width: w + 12, height: h + 32,
      background: '#0F1115', borderRadius: 14, padding: 6,
      boxShadow: '0 30px 80px -20px rgba(0,0,0,.4)',
    }}>
      <div style={{ height: 20, display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px' }}>
        <div style={{ width: 10, height: 10, borderRadius: 999, background: '#FF5F57' }} />
        <div style={{ width: 10, height: 10, borderRadius: 999, background: '#FEBC2E' }} />
        <div style={{ width: 10, height: 10, borderRadius: 999, background: '#28C840' }} />
        <div style={{ flex: 1, textAlign: 'center', fontSize: 11, color: '#6B6A75' }}>{label || 'dorent.am'}</div>
      </div>
      <div style={{ width: w, height: h, background: '#fff', borderRadius: 8, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}

function TabletFrame({ children, w = 768, h = 1024 }) {
  return (
    <div style={{
      width: w + 32, height: h + 32,
      background: '#0F1115', borderRadius: 32, padding: 16,
      boxShadow: '0 30px 80px -20px rgba(0,0,0,.4)',
    }}>
      <div style={{ width: w, height: h, background: '#fff', borderRadius: 18, overflow: 'hidden', position: 'relative' }}>
        {children}
      </div>
    </div>
  );
}

Object.assign(window, { DesktopHome, DesktopListing, TabletHome, DesktopFrame, TabletFrame });
