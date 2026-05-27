// flow-a-refine.jsx — Refinement pass on Flow A MVP
// 1. Simplified Profile (identity → quick actions → settings → logout)
// 2. Saved toys (favorites) + empty state
// 3. Admin reject dialog (bottom sheet with reasons)
// 4. Owner view-request detail screen
// 5. Consistency reference card

// =====================================================
// 1. SIMPLIFIED PROFILE — MVP
// =====================================================
function FAProfileMVP() {
  const t = TOKENS.A;

  const MenuRow = ({ icon, label, meta, badge, danger, last }) => (
    <div style={{
      padding: '14px 16px',
      display: 'flex', alignItems: 'center', gap: 12,
      borderBottom: last ? 'none' : `1px solid ${t.border}`,
      minHeight: 56,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: danger ? '#FFE8E5' : t.surfaceAlt,
        display: 'grid', placeItems: 'center',
      }}>
        <Icon name={icon} size={17} color={danger ? t.danger : t.text} />
      </div>
      <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: danger ? t.danger : t.text }}>{label}</span>
      {badge}
      {meta && <span style={{ fontSize: 12, color: t.textMute }}>{meta}</span>}
      {!danger && <Icon name="chevron" size={15} color={t.textMute} />}
    </div>
  );

  return (
    <MScreen dir="A" bg={t.bg}>
      <div style={{
        height: `calc(100% - ${FA_NAV_H + FA_NAV_PAD}px)`,
        overflow: 'hidden',
      }}>
        {/* Identity header */}
        <div style={{ padding: '20px 16px 18px', background: t.surface, borderBottom: `1px solid ${t.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ position: 'relative' }}>
              <img src={FAMILY_AVS.anna} style={{ width: 64, height: 64, borderRadius: 999, objectFit: 'cover' }} />
              <button style={{
                position: 'absolute', bottom: -2, right: -2,
                width: 24, height: 24, borderRadius: 999,
                background: t.primary, border: '2px solid #fff',
                display: 'grid', placeItems: 'center',
              }}>
                <Icon name="camera" size={11} color="#fff" />
              </button>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: t.text, letterSpacing: '-0.01em' }}>Anna Sargsyan</div>
              <div style={{ fontSize: 11.5, color: t.textMute, marginTop: 3 }}>Yerevan · Member since Mar 2026</div>
            </div>
            <button style={{
              height: 32, padding: '0 12px', borderRadius: 999,
              background: t.surfaceAlt, color: t.text, border: 0,
              fontSize: 12, fontWeight: 700,
            }}>Edit</button>
          </div>

          {/* Identity rows — phone, email */}
          <div style={{ marginTop: 16, display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: t.bg, borderRadius: 10 }}>
              <Icon name="user" size={14} color={t.textMute} />
              <span style={{ fontSize: 12, color: t.textMute, width: 50 }}>Name</span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: t.text }}>Anna Sargsyan</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: t.bg, borderRadius: 10 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.textMute} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.86 19.86 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.86 19.86 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0122 16.92z"/></svg>
              <span style={{ fontSize: 12, color: t.textMute, width: 50 }}>Phone</span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: t.text, fontVariantNumeric: 'tabular-nums' }}>+374 77 12 34 56</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: t.bg, borderRadius: 10 }}>
              <Icon name="mail" size={14} color={t.textMute} />
              <span style={{ fontSize: 12, color: t.textMute, width: 50 }}>Email</span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: t.text }}>anna@toyrent.am</span>
            </div>
          </div>
        </div>

        {/* Primary actions */}
        <div style={{ padding: '14px 16px 0' }}>
          <div style={{ background: t.surface, borderRadius: 14, border: `1px solid ${t.border}`, overflow: 'hidden' }}>
            <MenuRow icon="grid"     label="My toys"    meta="5 listings" />
            <MenuRow icon="calendar" label="My rentals" meta="2 upcoming" />
            <MenuRow icon="heart"    label="Favorites"  meta="8" last />
          </div>
        </div>

        {/* Settings + Support */}
        <div style={{ padding: '14px 16px 0' }}>
          <div style={{ background: t.surface, borderRadius: 14, border: `1px solid ${t.border}`, overflow: 'hidden' }}>
            <MenuRow icon="glob"    label="Language" meta="English" />
            <MenuRow icon="bell"    label="Notifications" />
            <MenuRow icon="message" label="Help center" last />
          </div>
        </div>

        {/* Logout */}
        <div style={{ padding: '14px 16px 8px' }}>
          <div style={{ background: t.surface, borderRadius: 14, border: `1px solid ${t.border}`, overflow: 'hidden' }}>
            <MenuRow icon="arrow" label="Log out" danger last />
          </div>
          <div style={{ textAlign: 'center', fontSize: 10.5, color: t.textMute, marginTop: 14 }}>
            ToyRent · v2.4.1
          </div>
        </div>
      </div>
      <FANav active={4} />
    </MScreen>
  );
}

// =====================================================
// 2. SAVED TOYS — favorites list
// =====================================================
function FASavedToys() {
  const t = TOKENS.A;
  return (
    <MScreen dir="A" bg={t.bg}>
      <FATopBar back title="Saved toys" />
      <div style={{
        padding: '12px 16px 4px',
        background: t.surface, borderBottom: `1px solid ${t.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 13, color: t.textMute }}>
          <strong style={{ color: t.text }}>8 saved</strong> · across 3 cities
        </span>
        <button style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'transparent', border: 0, fontSize: 12, color: t.text, fontWeight: 600 }}>
          Recent <Icon name="chevronD" size={11} color={t.text} />
        </button>
      </div>

      <div style={{
        height: `calc(100% - ${FA_HEADER_H + 44}px - ${FA_NAV_H + FA_NAV_PAD}px)`,
        overflow: 'hidden', padding: '14px 16px',
      }}>
        {/* Saved cards — note: heart not shown on cards (already saved). Long-press hint. */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FAListingCard img={TOY_IMGS.lego} title="LEGO Duplo Town" city="Kentron" price="₽1,500" age="2–5 yr" verified />
          <FAListingCard img={TOY_IMGS.wooden} title="Wooden balance bike" city="Aurora" price="₽800" age="3–6 yr" verified />
          <FAListingCard img={TOY_IMGS.kitchen} title="Wooden play kitchen" city="Davtashen" price="₽1,200" age="3–7 yr" verified />
          <FAListingCard img={TOY_IMGS.cars} title="Big-wheel race set" city="Center" price="₽600" age="4–8 yr" />
        </div>

        <div style={{ marginTop: 14, padding: 10, background: t.surface, borderRadius: 10, border: `1px dashed ${t.border}`, fontSize: 11, color: t.textMute, textAlign: 'center', lineHeight: 1.5 }}>
          Long-press a card to remove it from saved
        </div>
      </div>
      <FANav active={4} />
    </MScreen>
  );
}

// =====================================================
// 2b. SAVED TOYS EMPTY STATE
// =====================================================
function FASavedToysEmpty() {
  const t = TOKENS.A;
  return (
    <MScreen dir="A" bg={t.bg}>
      <FATopBar back title="Saved toys" />
      <div style={{
        height: `calc(100% - ${FA_HEADER_H}px - ${FA_NAV_H + FA_NAV_PAD}px)`,
        padding: '40px 24px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
      }}>
        <div style={{ width: 96, height: 96, borderRadius: 28, background: t.primarySoft, display: 'grid', placeItems: 'center', marginBottom: 16, position: 'relative' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={t.primary} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 21s-7-4.5-9.5-9C1 8.7 3.3 5 7 5c2 0 3.5 1 5 3 1.5-2 3-3 5-3 3.7 0 6 3.7 4.5 7-2.5 4.5-9.5 9-9.5 9z"/>
          </svg>
          <div style={{ position: 'absolute', top: -4, right: -4, width: 30, height: 30, borderRadius: 999, background: t.surface, display: 'grid', placeItems: 'center', boxShadow: '0 0 0 3px ' + t.bg }}>
            <Icon name="plus" size={14} color={t.primary} strokeWidth={2.5} />
          </div>
        </div>
        <h2 style={{ margin: '8px 0 6px', fontSize: 19, fontWeight: 800, color: t.text, letterSpacing: '-0.01em' }}>
          No saved toys yet
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: t.textMute, lineHeight: 1.5, maxWidth: 280 }}>
          Tap the heart on any toy to save it here for later.
        </p>
        <button style={{
          marginTop: 20, height: 48, padding: '0 22px',
          background: t.primary, color: '#fff',
          borderRadius: 999, border: 0,
          fontSize: 14, fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          <Icon name="grid" size={16} color="#fff" /> Browse toys
        </button>
      </div>
      <FANav active={4} />
    </MScreen>
  );
}

// =====================================================
// 3. MY TOYS EMPTY STATE (first-time owners) — refined
// =====================================================
function FAMyToysEmpty() {
  const t = TOKENS.A;
  return (
    <MScreen dir="A" bg={t.bg}>
      {/* Same header as My toys */}
      <div style={{ padding: '14px 16px 12px', background: t.surface, borderBottom: `1px solid ${t.border}` }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: t.text, letterSpacing: '-0.01em' }}>My toys</h1>
      </div>

      <div style={{
        height: `calc(100% - ${FA_HEADER_H}px - ${FA_NAV_H + FA_NAV_PAD}px)`,
        padding: '32px 24px 24px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
      }}>
        {/* Illustration */}
        <div style={{ width: 112, height: 112, borderRadius: 32, background: t.primarySoft, display: 'grid', placeItems: 'center', marginBottom: 16, position: 'relative' }}>
          <Icon name="grid" size={52} color={t.primary} />
          <div style={{
            position: 'absolute', top: -6, right: -6,
            width: 34, height: 34, borderRadius: 999,
            background: t.primary, display: 'grid', placeItems: 'center',
            boxShadow: '0 0 0 4px #fff',
          }}>
            <Icon name="plus" size={18} color="#fff" strokeWidth={2.5} />
          </div>
        </div>

        <h2 style={{ margin: '8px 0 6px', fontSize: 20, fontWeight: 800, color: t.text, letterSpacing: '-0.01em' }}>
          You haven't listed any toys yet
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: t.textMute, lineHeight: 1.55, maxWidth: 280 }}>
          List a toy in 2 minutes and start earning from things your kids have outgrown.
        </p>

        {/* Tiny benefit row */}
        <div style={{ marginTop: 24, width: '100%', display: 'grid', gap: 8 }}>
          {[
            { i: 'camera',   l: 'Add 3+ photos and a short description' },
            { i: 'tag',      l: 'Set a daily price — earn ~85% per rental' },
            { i: 'shield',   l: 'We verify every listing before it goes live' },
          ].map((b, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: t.surface, borderRadius: 12, border: `1px solid ${t.border}` }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: t.primarySoft, display: 'grid', placeItems: 'center' }}>
                <Icon name={b.i} size={14} color={t.primary} />
              </div>
              <span style={{ fontSize: 12.5, color: t.text, textAlign: 'left' }}>{b.l}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button style={{
          marginTop: 20, height: 52, padding: '0 24px',
          width: '100%',
          background: t.primary, color: '#fff',
          borderRadius: 999, border: 0,
          fontSize: 15, fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <Icon name="plus" size={17} color="#fff" strokeWidth={2.5} /> List your first toy
        </button>
        <div style={{ marginTop: 10, fontSize: 11, color: t.textMute }}>Takes about 2 minutes</div>
      </div>
      <FANav active={4} />
    </MScreen>
  );
}

// =====================================================
// 4. ADMIN REJECT DIALOG — bottom sheet with reasons
// =====================================================
function FAAdminRejectSheet() {
  const t = TOKENS.A;
  const reasons = [
    { l: 'Poor images',           sub: 'Blurry, dark, or too few photos',       icon: 'image',  sel: true },
    { l: 'Missing information',   sub: 'Incomplete title or description',       icon: 'flag' },
    { l: 'Duplicate listing',     sub: 'Same toy already exists',               icon: 'grid' },
    { l: 'Inappropriate content', sub: 'Violates community guidelines',         icon: 'x' },
    { l: 'Wrong category',        sub: 'Listed under incorrect category',       icon: 'tag' },
    { l: 'Unsafe item',           sub: 'Choking hazard, recalled, broken',      icon: 'shield' },
  ];
  return (
    <MScreen dir="A" bg="rgba(15,17,21,.45)">
      {/* Dimmed background hint — the listing being reviewed */}
      <div style={{ position: 'absolute', inset: 0, opacity: .35 }}>
        <FAAdminMini />
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,17,21,.55)' }} />

      {/* Sheet */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        background: t.surface, borderRadius: '24px 24px 0 0',
        padding: '12px 16px 24px',
        boxShadow: '0 -20px 40px rgba(0,0,0,.2)',
        animation: 'fa-slide-up .25s cubic-bezier(.2,.7,.3,1)',
      }}>
        <div style={{ width: 40, height: 4, background: t.border, borderRadius: 4, margin: '0 auto 14px' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: t.text, letterSpacing: '-0.01em' }}>
            Reject listing
          </h2>
          <button style={{ width: 32, height: 32, borderRadius: 999, background: t.surfaceAlt, border: 0, display: 'grid', placeItems: 'center' }}>
            <Icon name="x" size={15} color={t.text} />
          </button>
        </div>
        <p style={{ margin: '2px 0 14px', fontSize: 12, color: t.textMute, lineHeight: 1.5 }}>
          Choose a reason — Anna will see this so she can fix and re-submit.
        </p>

        {/* Reasons list */}
        <div style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
          {reasons.map((r, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px',
              background: r.sel ? t.primarySoft : t.bg,
              border: r.sel ? `1.5px solid ${t.primary}` : `1px solid ${t.border}`,
              borderRadius: 12,
            }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: r.sel ? '#fff' : t.surface, display: 'grid', placeItems: 'center' }}>
                <Icon name={r.icon} size={15} color={r.sel ? t.primary : t.textMute} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: r.sel ? t.primary : t.text }}>{r.l}</div>
                <div style={{ fontSize: 10.5, color: t.textMute, marginTop: 1 }}>{r.sub}</div>
              </div>
              {r.sel
                ? <div style={{ width: 22, height: 22, borderRadius: 999, background: t.primary, display: 'grid', placeItems: 'center' }}>
                    <Icon name="check" size={13} color="#fff" strokeWidth={2.5} />
                  </div>
                : <div style={{ width: 22, height: 22, borderRadius: 999, border: `2px solid ${t.border}` }} />
              }
            </div>
          ))}
        </div>

        {/* Optional note */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: t.text }}>Add a note <span style={{ color: t.textMute, fontWeight: 500 }}>(optional)</span></label>
          <div style={{ minHeight: 70, padding: '10px 12px', borderRadius: t.radius, background: t.surface, border: `1.5px solid ${t.border}`, fontSize: 13, color: t.textMute, lineHeight: 1.5 }}>
            E.g. "Photos are too dark — please retake in daylight."
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={{ flex: 1, height: 48, background: t.surface, color: t.text, borderRadius: 999, border: `1.5px solid ${t.border}`, fontSize: 14, fontWeight: 700 }}>Cancel</button>
          <button style={{ flex: 1.5, height: 48, background: t.danger, color: '#fff', borderRadius: 999, border: 0, fontSize: 14, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Icon name="x" size={14} color="#fff" strokeWidth={2.5} /> Confirm reject
          </button>
        </div>
      </div>
    </MScreen>
  );
}

// Background mini for the reject sheet
function FAAdminMini() {
  const t = TOKENS.A;
  return (
    <div style={{ width: '100%', height: '100%', background: t.bg }}>
      <div style={{ height: 60, background: t.surface, borderBottom: `1px solid ${t.border}` }} />
      <div style={{ padding: 14 }}>
        <div style={{ background: t.surface, borderRadius: 16, border: `1px solid ${t.border}`, padding: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginBottom: 10 }}>
            <img src={TOY_IMGS.lego} style={{ aspectRatio: '1/1', width: '100%', objectFit: 'cover', borderRadius: 6 }} />
            <img src={TOY_IMGS.blocks} style={{ aspectRatio: '1/1', width: '100%', objectFit: 'cover', borderRadius: 6 }} />
            <img src={TOY_IMGS.cars} style={{ aspectRatio: '1/1', width: '100%', objectFit: 'cover', borderRadius: 6 }} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>LEGO Duplo Town Set</div>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// 5. OWNER VIEW REQUEST — deep view before deciding
// =====================================================
function FAViewRequest() {
  const t = TOKENS.A;
  return (
    <MScreen dir="A" bg={t.bg}>
      <FATopBar back title="Request from Marina" />
      <div style={{
        height: `calc(100% - ${FA_HEADER_H}px)`,
        overflow: 'hidden',
        paddingBottom: 96, // space for sticky action bar
      }}>
        <div style={{ padding: '16px 16px 18px' }}>
          {/* Status */}
          <Badge tone="warn" dir="A">● Awaiting your reply · 3h ago</Badge>

          {/* Renter profile preview */}
          <div style={{ marginTop: 12, padding: 14, background: t.surface, borderRadius: 16, border: `1px solid ${t.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img src={FAMILY_AVS.marina} style={{ width: 56, height: 56, borderRadius: 999, objectFit: 'cover' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: t.text, display: 'flex', alignItems: 'center', gap: 4 }}>
                  Marina Hovhannisyan <Icon name="verified" size={14} color={t.success} />
                </div>
                <div style={{ fontSize: 11.5, color: t.textMute, marginTop: 2 }}>Yerevan · Joined Apr 2026</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <Icon name="star" size={11} color="#F2A900" />
                  <span style={{ fontSize: 11, fontWeight: 700, color: t.text }}>4.8</span>
                  <span style={{ fontSize: 10.5, color: t.textMute }}>· 3 previous rentals</span>
                </div>
              </div>
            </div>
            {/* Mini-stats row */}
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${t.border}`, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                { l: 'Rentals', v: '3' },
                { l: 'On-time return', v: '100%' },
                { l: 'Verified', v: 'ID + 📞' },
              ].map((s, i) => (
                <div key={i} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: t.text }}>{s.v}</div>
                  <div style={{ fontSize: 10, color: t.textMute, marginTop: 2 }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Message */}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.textMute, letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 8 }}>Message from Marina</div>
            <div style={{ padding: '12px 14px', background: t.primarySoft + '60', borderRadius: 12, fontSize: 13, color: t.text, lineHeight: 1.55, borderLeft: `2px solid ${t.primary}` }}>
              "Hi Anna! Is morning pickup possible? My son turns 3 on Monday and I'd love to surprise him with this set 🎉. Could also pick up Sunday evening if easier."
            </div>
          </div>

          {/* Toy + dates */}
          <div style={{ marginTop: 14, padding: 14, background: t.surface, borderRadius: 16, border: `1px solid ${t.border}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.textMute, letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 10 }}>Request details</div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
              <img src={TOY_IMGS.lego} style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>LEGO Duplo Town Set</div>
                <div style={{ fontSize: 11, color: t.textMute, marginTop: 2 }}>Your listing · ₽1,500 / day</div>
              </div>
            </div>
            {/* Pickup / Return */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8 }}>
              <div style={{ padding: 10, background: t.bg, borderRadius: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: t.textMute, letterSpacing: '.04em', textTransform: 'uppercase' }}>Pickup</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginTop: 2 }}>Mon 18 May</div>
              </div>
              <div style={{ fontSize: 10, color: t.textMute, fontWeight: 600 }}>4 days</div>
              <div style={{ padding: 10, background: t.bg, borderRadius: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: t.textMute, letterSpacing: '.04em', textTransform: 'uppercase' }}>Return</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginTop: 2 }}>Fri 22 May</div>
              </div>
            </div>
          </div>

          {/* Price summary */}
          <div style={{ marginTop: 14, padding: 14, background: t.surface, borderRadius: 16, border: `1px solid ${t.border}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.textMute, letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 10 }}>Price summary</div>
            <div style={{ display: 'grid', gap: 6, fontSize: 13, color: t.textMute }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>₽1,500 × 4 days</span><span style={{ color: t.text, fontWeight: 600 }}>₽6,000</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Service fee (15%)</span><span style={{ color: t.text, fontWeight: 600 }}>−₽900</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Refundable deposit</span><span style={{ color: t.text, fontWeight: 600 }}>₽1,000</span></div>
              <div style={{ height: 1, background: t.border, margin: '6px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontWeight: 700, color: t.text }}>You'll earn</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: t.primary }}>₽5,100</span>
              </div>
            </div>
          </div>

          {/* Reply quick options */}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.textMute, letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 8 }}>Reply</div>
            <button style={{ width: '100%', height: 44, background: t.surface, color: t.text, borderRadius: 12, border: `1px solid ${t.border}`, fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Icon name="message" size={14} color={t.text} /> Message Marina
              </span>
              <Icon name="chevron" size={14} color={t.textMute} />
            </button>
          </div>
        </div>
      </div>

      {/* Sticky decision bar (operational pattern, only on this screen) */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: t.surface, borderTop: `1px solid ${t.border}`,
        padding: '12px 16px 24px',
        display: 'flex', gap: 10,
      }}>
        <button style={{ flex: 1, height: 48, background: t.surface, color: t.danger, borderRadius: 999, border: `1.5px solid ${t.border}`, fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Icon name="x" size={14} color={t.danger} /> Decline
        </button>
        <button style={{ flex: 1.5, height: 48, background: t.primary, color: '#fff', borderRadius: 999, border: 0, fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Icon name="check" size={14} color="#fff" strokeWidth={2.5} /> Accept request
        </button>
      </div>
    </MScreen>
  );
}

// =====================================================
// CONSISTENCY REFERENCE — what got tightened
// =====================================================
function FAConsistencyBoard() {
  const t = TOKENS.A;
  const Row = ({ token, value, where }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '160px 100px 1fr', gap: 10, padding: '8px 0', borderBottom: `1px solid ${t.border}`, alignItems: 'baseline', fontSize: 12 }}>
      <span style={{ fontWeight: 600, color: t.text }}>{token}</span>
      <span style={{ fontFamily: "'JetBrains Mono',monospace", color: t.primary, fontSize: 11.5 }}>{value}</span>
      <span style={{ color: t.textMute, fontSize: 11.5 }}>{where}</span>
    </div>
  );
  return (
    <div style={{ width: 1480, background: '#fff', borderRadius: 12, padding: 32, border: `1px solid ${t.border}` }}>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', color: t.primary, textTransform: 'uppercase' }}>Refinement pass</div>
        <h2 style={{ margin: '4px 0 6px', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>Consistency reference</h2>
        <p style={{ margin: 0, fontSize: 13, color: t.textMute, maxWidth: 720, lineHeight: 1.55 }}>
          Single source of truth for the values every Flow A screen should use. If a screen disagrees with these, the screen is wrong.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div>
          <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700 }}>Heights &amp; sizing</h3>
          <Row token="Button height (md)" value="44px" where="Primary CTA, secondary actions" />
          <Row token="Button height (sm)" value="36px" where="In-card actions, chips" />
          <Row token="Button height (lg)" value="52px" where="Hero CTA, final submit" />
          <Row token="Input height" value="48px" where="All form fields" />
          <Row token="Chip height" value="32px" where="Filters, category chips" />
          <Row token="Bottom nav height" value="76px" where="Includes 18px safe bottom" />
          <Row token="Header height" value="56px" where="Top bar across all screens" />
          <Row token="Icon (default)" value="18px" where="Inside cards &amp; lists" />
          <Row token="Icon (nav)" value="22px" where="Bottom nav tabs" />

          <h3 style={{ margin: '20px 0 10px', fontSize: 14, fontWeight: 700 }}>Spacing</h3>
          <Row token="Screen edge" value="16px" where="Default horizontal page padding" />
          <Row token="Card padding" value="12–16px" where="Internal card content" />
          <Row token="Bottom nav clearance" value="92px" where="76 nav + 16 safe space below content" />
          <Row token="Section gap" value="14–18px" where="Between cards / blocks" />
        </div>

        <div>
          <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700 }}>Radius</h3>
          <Row token="Pill" value="999px" where="Buttons, chips, status badges" />
          <Row token="Card" value="14–16px" where="Listing card, surface card" />
          <Row token="Input" value="14px" where="All text inputs &amp; selects" />
          <Row token="Sheet" value="24px top" where="Bottom sheets, modals" />
          <Row token="Avatar" value="999px" where="All user avatars" />

          <h3 style={{ margin: '20px 0 10px', fontSize: 14, fontWeight: 700 }}>Typography</h3>
          <Row token="H1 / page title" value="22–24/800" where="Top of each screen" />
          <Row token="H2 / section" value="16/700" where="In-card section titles" />
          <Row token="Body" value="13/500–600" where="Most content" />
          <Row token="Helper / caption" value="11/500" where="Muted text, metadata" />
          <Row token="Micro / pill" value="10.5–11/600" where="Badges, status, tabs" />

          <h3 style={{ margin: '20px 0 10px', fontSize: 14, fontWeight: 700 }}>Shadow</h3>
          <Row token="Cards (default)" value="border-only" where="No elevation on resting cards" />
          <Row token="Floating button" value="0 6 16/30%" where="Bottom nav center +, FAB" />
          <Row token="Bottom sheet" value="0 -20 40/20%" where="Auth, reject, date picker" />
        </div>
      </div>

      {/* Changes summary */}
      <div style={{ marginTop: 28, padding: 18, background: t.bg, borderRadius: 14, border: `1px dashed ${t.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Icon name="sparkle" size={16} color={t.primary} />
          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>What changed in this pass</h4>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, fontSize: 12, color: t.text, lineHeight: 1.55 }}>
          <div>
            <strong style={{ color: t.text }}>Profile simplified</strong>
            <div style={{ color: t.textMute, marginTop: 4 }}>Removed earnings, ID verification, advanced host metrics. Identity block (name/phone/email) is now the header. Three primary actions, three settings, logout.</div>
          </div>
          <div>
            <strong style={{ color: t.text }}>Operational depth added</strong>
            <div style={{ color: t.textMute, marginTop: 4 }}>Owner now has a view-request detail screen with renter preview, mini-stats, full message, price summary. Admin reject is a bottom sheet with 6 reasons + optional note.</div>
          </div>
          <div>
            <strong style={{ color: t.text }}>States completed</strong>
            <div style={{ color: t.textMute, marginTop: 4 }}>Saved toys (with empty state). My toys empty state with motivational tone &amp; benefit row. CTAs sized to 48–52px and aligned to safe-bottom spacing.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  FAProfileMVP, FASavedToys, FASavedToysEmpty,
  FAMyToysEmpty, FAAdminRejectSheet, FAViewRequest,
  FAConsistencyBoard,
});
