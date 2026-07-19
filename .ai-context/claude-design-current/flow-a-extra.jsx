// flow-a-extra.jsx — Additional Flow A MVP screens
// 1. Create Listing  2. My Bookings  3. Booking Detail
// 4. Owner Incoming Requests  5. Admin Moderation  6. Profile
// 7. Listings (browse) Empty State  8. Booking Error State

// =====================================================
// 1. CREATE LISTING — 4-step wizard, step 2 visible
// =====================================================
function FACreateListing({ step = 1 }) {
  const t = TOKENS.A;
  const steps = ['Photos', 'Basics', 'Pricing', 'Hygiene'];
  return (
    <MScreen dir="A" bg={t.bg}>
      <div style={{ background: t.surface, borderBottom: `1px solid ${t.border}`, padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <button style={{ width: 36, height: 36, borderRadius: 999, background: 'transparent', border: 0, display: 'grid', placeItems: 'center' }}>
            <Icon name="chevronL" size={20} color={t.text} />
          </button>
          <span style={{ fontSize: 12, fontWeight: 600, color: t.textMute }}>Step {step + 1} of 4 · {steps[step]}</span>
          <button style={{ background: 'transparent', border: 0, fontSize: 13, fontWeight: 600, color: t.textMute }}>Save</button>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= step ? t.primary : t.surfaceAlt }} />
          ))}
        </div>
      </div>

      <div style={{ height: `calc(100% - ${FA_HEADER_H + 30}px)`, overflow: 'hidden', padding: '18px 16px 24px' }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: t.text, letterSpacing: '-0.02em' }}>Tell us about your toy</h1>
        <p style={{ margin: '4px 0 18px', fontSize: 13, color: t.textMute }}>The clearer the basics, the faster you'll get a renter.</p>

        <div style={{ display: 'grid', gap: 14 }}>
          {/* Photos preview */}
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 12, fontWeight: 600, color: t.text }}>Photos · 3 added</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ width: 60, height: 60, borderRadius: 10, overflow: 'hidden', position: 'relative' }}>
                <img src={TOY_IMGS.lego} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', top: 2, left: 2, padding: '1px 5px', background: t.primary, color: '#fff', fontSize: 9, fontWeight: 700, borderRadius: 4 }}>Cover</div>
              </div>
              <div style={{ width: 60, height: 60, borderRadius: 10, overflow: 'hidden' }}>
                <img src={TOY_IMGS.blocks} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ width: 60, height: 60, borderRadius: 10, overflow: 'hidden' }}>
                <img src={TOY_IMGS.cars} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <button style={{ width: 60, height: 60, borderRadius: 10, background: t.surface, border: `1.5px dashed ${t.border}`, display: 'grid', placeItems: 'center' }}>
                <Icon name="plus" size={18} color={t.textMute} />
              </button>
            </div>
          </div>

          <Input label="Toy name" value="LEGO Duplo Town Set" state="filled" helper="Keep it short and searchable" />

          {/* Category select */}
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: t.text }}>Category</label>
            <div style={{ height: 48, padding: '0 14px', borderRadius: t.radius, background: t.surface, border: `1.5px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 24, height: 24, borderRadius: 6, background: t.primarySoft, display: 'grid', placeItems: 'center' }}>
                <Icon name="grid" size={13} color={t.primary} />
              </div>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: t.text }}>LEGO &amp; Bricks</span>
              <Icon name="chevronD" size={15} color={t.textMute} />
            </div>
          </div>

          {/* Age range */}
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: t.text }}>Age range</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['0–2 yr', '2–5 yr', '6–8 yr', '9–12 yr'].map((age, i) => (
                <span key={i} style={{
                  padding: '7px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                  background: i === 1 ? t.primary : t.surface,
                  color: i === 1 ? '#fff' : t.text,
                  border: i === 1 ? 'none' : `1px solid ${t.border}`,
                }}>{age}</span>
              ))}
            </div>
          </div>

          {/* Condition */}
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: t.text }}>Condition</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {['Like new', 'Gently used', 'Used', 'Worn'].map((c, i) => (
                <span key={i} style={{
                  flex: 1, height: 36, borderRadius: 999,
                  background: i === 1 ? t.text : t.surface,
                  color: i === 1 ? '#fff' : t.text,
                  border: i === 1 ? 'none' : `1px solid ${t.border}`,
                  display: 'grid', placeItems: 'center',
                  fontSize: 11.5, fontWeight: 600,
                }}>{c}</span>
              ))}
            </div>
          </div>

          {/* Action row */}
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button style={{ flex: 1, height: 48, background: t.surface, color: t.text, borderRadius: 999, border: `1.5px solid ${t.border}`, fontSize: 14, fontWeight: 700 }}>Back</button>
            <button style={{ flex: 1.5, height: 48, background: t.primary, color: '#fff', borderRadius: 999, border: 0, fontSize: 14, fontWeight: 700 }}>Continue to pricing</button>
          </div>
        </div>
      </div>
    </MScreen>
  );
}

// =====================================================
// 2. MY BOOKINGS — tabs Upcoming / Active / Past
// =====================================================
function FAMyBookings() {
  const t = TOKENS.A;
  const upcoming = [
    { img: TOY_IMGS.lego, title: 'LEGO Duplo Town', owner: 'Anna · Kentron', status: 'confirmed', dates: '18 – 22 May', total: '₽7,300', pickup: 'Tomorrow, 18:00' },
    { img: TOY_IMGS.wooden, title: 'Wooden balance bike', owner: 'David · Aurora', status: 'pending', dates: '25 – 29 May', total: '₽3,400' },
  ];
  return (
    <MScreen dir="A" bg={t.bg}>
      <div style={{ padding: '14px 16px 12px', background: t.surface, borderBottom: `1px solid ${t.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: t.text, letterSpacing: '-0.01em' }}>My rentals</h1>
          <button style={{ width: 36, height: 36, borderRadius: 999, background: t.surfaceAlt, display: 'grid', placeItems: 'center', border: 0 }}>
            <Icon name="filter" size={16} color={t.text} />
          </button>
        </div>
        <div style={{ display: 'flex', gap: 18, marginTop: 14, marginBottom: -10 }}>
          {[
            { l: 'Upcoming', c: 2, active: true },
            { l: 'Active', c: 1 },
            { l: 'Past', c: 8 },
          ].map((tab, i) => (
            <div key={i} style={{ paddingBottom: 10, borderBottom: tab.active ? `2px solid ${t.primary}` : '2px solid transparent', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: tab.active ? t.primary : t.textMute }}>{tab.l}</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: tab.active ? t.primarySoft : t.surfaceAlt, color: tab.active ? t.primary : t.textMute }}>{tab.c}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{
        height: `calc(100% - ${FA_HEADER_H + 50}px - ${FA_NAV_H + FA_NAV_PAD}px)`,
        overflow: 'hidden', padding: '14px 16px',
      }}>
        {/* Pickup reminder */}
        <div style={{ padding: 12, background: t.primarySoft, borderRadius: 12, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 999, background: '#fff', display: 'grid', placeItems: 'center' }}>
            <Icon name="clock" size={18} color={t.primary} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: t.primary }}>Pickup tomorrow at 18:00</div>
            <div style={{ fontSize: 11, color: t.text, marginTop: 1 }}>LEGO Duplo Town · Kentron metro</div>
          </div>
          <Icon name="chevron" size={16} color={t.primary} />
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          {upcoming.map((b, i) => (
            <div key={i} style={{ background: t.surface, borderRadius: 14, border: `1px solid ${t.border}`, padding: 12 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <img src={b.img} style={{ width: 64, height: 64, borderRadius: 10, objectFit: 'cover' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    {b.status === 'confirmed'
                      ? <Badge tone="success" dir="A">● Confirmed</Badge>
                      : <Badge tone="warn" dir="A">● Awaiting reply</Badge>}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{b.title}</div>
                  <div style={{ fontSize: 11, color: t.textMute, marginTop: 2 }}>{b.owner}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 11, color: t.text }}>
                    <Icon name="calendar" size={12} color={t.textMute} />
                    <span style={{ fontWeight: 600 }}>{b.dates}</span>
                    <span style={{ color: t.textMute }}>·</span>
                    <span style={{ fontWeight: 700, color: t.primary }}>{b.total}</span>
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${t.border}`, display: 'flex', gap: 8 }}>
                <button style={{ flex: 1, height: 36, background: t.surfaceAlt, color: t.text, borderRadius: 999, border: 0, fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                  <Icon name="message" size={13} color={t.text} /> Message
                </button>
                <button style={{ flex: 1, height: 36, background: t.text, color: '#fff', borderRadius: 999, border: 0, fontSize: 12, fontWeight: 700 }}>View booking</button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <FANav active={3} />
    </MScreen>
  );
}

// =====================================================
// 3. BOOKING DETAIL — single booking deep view
// =====================================================
function FABookingDetail() {
  const t = TOKENS.A;
  return (
    <MScreen dir="A" bg={t.bg}>
      <FATopBar back title="Booking #4821" />
      <div style={{
        height: `calc(100% - ${FA_HEADER_H}px)`,
        overflow: 'hidden', padding: '16px 16px 24px',
      }}>
        {/* Status hero */}
        <div style={{ padding: 16, background: t.surface, borderRadius: 16, border: `1px solid ${t.border}`, marginBottom: 14 }}>
          <Badge tone="success" dir="A">● Confirmed by Anna</Badge>
          <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'center' }}>
            <img src={TOY_IMGS.lego} style={{ width: 72, height: 72, borderRadius: 12, objectFit: 'cover' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>LEGO Duplo Town Set</div>
              <div style={{ fontSize: 11, color: t.textMute, marginTop: 2 }}>Booking #4821</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginTop: 6 }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: t.primary }}>₽7,300</span>
                <span style={{ fontSize: 11, color: t.textMute }}>· 4 days</span>
              </div>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div style={{ padding: 16, background: t.surface, borderRadius: 16, border: `1px solid ${t.border}`, marginBottom: 14 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: t.text }}>Schedule</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 10 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: t.textMute, letterSpacing: '.04em', textTransform: 'uppercase' }}>Pickup</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginTop: 2 }}>Mon 18 May</div>
              <div style={{ fontSize: 11, color: t.textMute }}>18:00 · Kentron metro</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '0 6px' }}>
              <div style={{ fontSize: 10, color: t.textMute, fontWeight: 600 }}>4 days</div>
              <div style={{ flex: 1, width: 1, background: t.border, minHeight: 16 }} />
              <Icon name="chevron" size={12} color={t.primary} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: t.textMute, letterSpacing: '.04em', textTransform: 'uppercase' }}>Return</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginTop: 2 }}>Fri 22 May</div>
              <div style={{ fontSize: 11, color: t.textMute }}>20:00 · same spot</div>
            </div>
          </div>
        </div>

        {/* Owner */}
        <FAOwnerCard revealed />

        {/* Price */}
        <div style={{ marginTop: 14, padding: 14, background: t.surface, borderRadius: 16, border: `1px solid ${t.border}` }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: t.text }}>Price details</h3>
          <div style={{ display: 'grid', gap: 6, fontSize: 13, color: t.textMute }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>₽1,500 × 4 days</span><span style={{ color: t.text, fontWeight: 600 }}>₽6,000</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Service fee</span><span style={{ color: t.text, fontWeight: 600 }}>₽300</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Refundable deposit</span><span style={{ color: t.text, fontWeight: 600 }}>₽1,000</span></div>
            <div style={{ height: 1, background: t.border, margin: '6px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Total</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: t.text }}>₽7,300</span>
            </div>
          </div>
        </div>

        {/* Cancel link */}
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <button style={{ background: 'transparent', border: 0, fontSize: 12, fontWeight: 600, color: t.danger }}>Cancel booking</button>
          <div style={{ fontSize: 10.5, color: t.textMute, marginTop: 4, lineHeight: 1.45 }}>Free cancellation until 24h before pickup.</div>
        </div>
      </div>
    </MScreen>
  );
}

// =====================================================
// 4. OWNER INCOMING REQUESTS — list with accept/decline
// =====================================================
function FAIncomingRequests() {
  const t = TOKENS.A;
  const reqs = [
    { renter: 'Marina Hovhannisyan', av: FAMILY_AVS.marina, img: TOY_IMGS.lego, toy: 'LEGO Duplo Town', dates: '18 – 22 May', days: 4, total: '₽7,300', msg: 'Hi Anna! Is morning pickup possible? My son turns 3 on Mon 🎉', age: 'New' },
    { renter: 'David Petrosyan', av: FAMILY_AVS.david, img: TOY_IMGS.kitchen, toy: 'Wooden play kitchen', dates: '25 – 26 May', days: 2, total: '₽2,800', msg: 'Looking for a weekend rental, can pick up Sat after 10am.', age: '3h ago' },
    { renter: 'Aram Karapetyan', av: FAMILY_AVS.aram, img: TOY_IMGS.plush, toy: 'Plush family pack', dates: '1 – 7 Jun', days: 7, total: '₽4,100', msg: '', age: '1d ago' },
  ];
  return (
    <MScreen dir="A" bg={t.bg}>
      <div style={{ padding: '14px 16px 12px', background: t.surface, borderBottom: `1px solid ${t.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: t.text, letterSpacing: '-0.01em' }}>Incoming requests</h1>
          <Badge tone="primary" dir="A">3 new</Badge>
        </div>
        <div style={{ display: 'flex', gap: 18, marginTop: 14, marginBottom: -10 }}>
          {[
            { l: 'New', c: 3, active: true },
            { l: 'Confirmed', c: 2 },
            { l: 'Declined', c: 1 },
          ].map((tab, i) => (
            <div key={i} style={{ paddingBottom: 10, borderBottom: tab.active ? `2px solid ${t.primary}` : '2px solid transparent', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: tab.active ? t.primary : t.textMute }}>{tab.l}</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: tab.active ? t.primarySoft : t.surfaceAlt, color: tab.active ? t.primary : t.textMute }}>{tab.c}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{
        height: `calc(100% - ${FA_HEADER_H + 50}px - ${FA_NAV_H + FA_NAV_PAD}px)`,
        overflow: 'hidden', padding: '14px 16px',
      }}>
        <div style={{ display: 'grid', gap: 12 }}>
          {reqs.map((r, i) => (
            <div key={i} style={{ background: t.surface, borderRadius: 14, border: `1px solid ${t.border}`, padding: 14 }}>
              {/* Renter row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <img src={r.av} style={{ width: 38, height: 38, borderRadius: 999, objectFit: 'cover' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.renter}</div>
                  <div style={{ fontSize: 10.5, color: t.textMute, marginTop: 1 }}>{r.age} · first rental</div>
                </div>
                <button style={{ width: 32, height: 32, borderRadius: 999, background: t.surfaceAlt, border: 0, display: 'grid', placeItems: 'center' }}>
                  <Icon name="message" size={15} color={t.text} />
                </button>
              </div>
              {/* Toy summary row */}
              <div style={{ display: 'flex', gap: 10, padding: 10, background: t.bg, borderRadius: 10, marginBottom: r.msg ? 12 : 0 }}>
                <img src={r.img} style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.toy}</div>
                  <div style={{ fontSize: 11, color: t.textMute, marginTop: 2 }}>{r.dates} · {r.days} days</div>
                </div>
                <span style={{ fontSize: 14, fontWeight: 800, color: t.primary, alignSelf: 'center' }}>{r.total}</span>
              </div>
              {/* Message */}
              {r.msg && (
                <div style={{ padding: '10px 12px', background: t.primarySoft + '60', borderRadius: 10, fontSize: 12, color: t.text, lineHeight: 1.5, marginBottom: 12, borderLeft: `2px solid ${t.primary}` }}>
                  "{r.msg}"
                </div>
              )}
              {/* Actions */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={{ flex: 1, height: 40, background: t.surface, color: t.danger, borderRadius: 999, border: `1.5px solid ${t.border}`, fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                  <Icon name="x" size={14} color={t.danger} /> Decline
                </button>
                <button style={{ flex: 1.5, height: 40, background: t.primary, color: '#fff', borderRadius: 999, border: 0, fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                  <Icon name="check" size={14} color="#fff" strokeWidth={2.5} /> Accept
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <FANav active={3} />
    </MScreen>
  );
}

// =====================================================
// 5. ADMIN MODERATION — review queue, single listing focus
// =====================================================
function FAAdminModeration() {
  const t = TOKENS.A;
  return (
    <MScreen dir="A" bg={t.bg}>
      <div style={{ padding: '14px 16px 12px', background: t.surface, borderBottom: `1px solid ${t.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button style={{ width: 36, height: 36, borderRadius: 999, background: 'transparent', border: 0, display: 'grid', placeItems: 'center' }}>
              <Icon name="chevronL" size={20} color={t.text} />
            </button>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: t.text }}>Review queue</div>
              <div style={{ fontSize: 10.5, color: t.textMute }}>14 awaiting · oldest 3h ago</div>
            </div>
          </div>
          <Badge tone="warn" dir="A">Admin</Badge>
        </div>
        <div style={{ display: 'flex', gap: 6, overflow: 'hidden', marginTop: 14 }}>
          <Chip dir="A" active>All · 14</Chip>
          <Chip dir="A">New owners · 4</Chip>
          <Chip dir="A">Flagged · 2</Chip>
        </div>
      </div>

      <div style={{
        height: `calc(100% - ${FA_HEADER_H + 50}px)`,
        overflow: 'hidden', padding: '14px 16px',
        paddingBottom: 100, // room for decision bar
      }}>
        <div style={{ background: t.surface, borderRadius: 16, border: `1px solid ${t.border}`, overflow: 'hidden' }}>
          {/* Photo grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, padding: 2 }}>
            <img src={TOY_IMGS.lego} style={{ aspectRatio: '1/1', width: '100%', objectFit: 'cover', borderRadius: 6 }} />
            <img src={TOY_IMGS.blocks} style={{ aspectRatio: '1/1', width: '100%', objectFit: 'cover', borderRadius: 6 }} />
            <img src={TOY_IMGS.cars} style={{ aspectRatio: '1/1', width: '100%', objectFit: 'cover', borderRadius: 6 }} />
          </div>
          <div style={{ padding: 14 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: t.text }}>LEGO Duplo Town Set</h3>
            <div style={{ fontSize: 12, color: t.textMute, marginTop: 4, lineHeight: 1.5 }}>
              Gently-used set, all pieces accounted for. Recently sanitized…
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 6, marginTop: 12 }}>
              <div style={{ fontSize: 11, color: t.textMute }}>Category</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: t.text }}>LEGO &amp; Bricks</div>
              <div style={{ fontSize: 11, color: t.textMute }}>Age</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: t.text }}>2–5 yrs</div>
              <div style={{ fontSize: 11, color: t.textMute }}>Price</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: t.text }}>₽1,500 / day</div>
            </div>
            <div style={{ marginTop: 12, padding: 10, background: t.bg, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src={FAMILY_AVS.anna} style={{ width: 30, height: 30, borderRadius: 999 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>Anna Sargsyan</div>
                <div style={{ fontSize: 10, color: t.textMute }}>First listing · joined 2 days ago</div>
              </div>
              <Badge tone="warn" dir="A">New owner</Badge>
            </div>
            {/* AI auto-check */}
            <div style={{ marginTop: 10, padding: 10, background: '#E6F4EE', borderRadius: 10, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <Icon name="sparkle" size={14} color={t.success} />
              <div style={{ fontSize: 11, color: t.text, lineHeight: 1.45 }}>
                <strong>Auto-check passed:</strong> photos clear, no banned items, age within range.
              </div>
            </div>
            {/* Rejection reasons (collapsed) */}
            <button style={{ marginTop: 10, width: '100%', height: 36, background: t.surfaceAlt, color: t.text, borderRadius: 10, border: 0, fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <Icon name="flag" size={13} color={t.textMute} /> Flag with reason
            </button>
          </div>
        </div>
      </div>

      {/* Decision bar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: t.surface, borderTop: `1px solid ${t.border}`, padding: '12px 16px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <button style={{ height: 44, borderRadius: 999, background: t.surfaceAlt, border: 0, fontSize: 12, fontWeight: 700, color: t.text }}>Skip</button>
        <button style={{ height: 44, borderRadius: 999, background: '#FFE8E5', border: 0, color: t.danger, fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          <Icon name="x" size={14} color={t.danger} /> Reject
        </button>
        <button style={{ height: 44, borderRadius: 999, background: t.success, border: 0, color: '#fff', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          <Icon name="check" size={14} color="#fff" strokeWidth={2.5} /> Approve
        </button>
      </div>
    </MScreen>
  );
}

// =====================================================
// 6. PROFILE
// =====================================================
function FAProfile() {
  const t = TOKENS.A;
  return (
    <MScreen dir="A" bg={t.bg}>
      <div style={{
        height: `calc(100% - ${FA_NAV_H + FA_NAV_PAD}px)`,
        overflow: 'hidden',
      }}>
        {/* Header card */}
        <div style={{ padding: '20px 16px 16px', background: t.surface, borderBottom: `1px solid ${t.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ position: 'relative' }}>
              <img src={FAMILY_AVS.anna} style={{ width: 64, height: 64, borderRadius: 999, objectFit: 'cover' }} />
              <button style={{ position: 'absolute', bottom: -2, right: -2, width: 24, height: 24, borderRadius: 999, background: t.primary, border: '2px solid #fff', display: 'grid', placeItems: 'center' }}>
                <Icon name="camera" size={11} color="#fff" />
              </button>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: t.text, display: 'flex', alignItems: 'center', gap: 4 }}>
                Anna Sargsyan <Icon name="verified" size={16} color={t.success} />
              </div>
              <div style={{ fontSize: 11, color: t.textMute, marginTop: 2 }}>Member since 2024 · Yerevan</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <Icon name="star" size={12} color="#F2A900" />
                <span style={{ fontSize: 12, fontWeight: 700, color: t.text }}>4.9</span>
                <span style={{ fontSize: 11, color: t.textMute }}>· 24 reviews</span>
              </div>
            </div>
            <button style={{ width: 36, height: 36, borderRadius: 999, background: t.surfaceAlt, border: 0, display: 'grid', placeItems: 'center' }}>
              <Icon name="image" size={15} color={t.text} />
            </button>
          </div>

          {/* Stats */}
          <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {[
              { l: 'Listings', v: '5' },
              { l: 'Rentals', v: '11' },
              { l: 'Earned', v: '₽38k' },
            ].map((s, i) => (
              <div key={i} style={{ padding: '10px 4px', background: t.bg, borderRadius: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: t.text, letterSpacing: '-0.01em' }}>{s.v}</div>
                <div style={{ fontSize: 10.5, color: t.textMute, marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Menu sections */}
        <div style={{ padding: '14px 16px' }}>
          <div style={{ background: t.surface, borderRadius: 14, border: `1px solid ${t.border}`, overflow: 'hidden', marginBottom: 14 }}>
            {[
              { l: 'My toys',          i: 'grid',    meta: '5 listings' },
              { l: 'My rentals',       i: 'calendar', meta: '2 upcoming' },
              { l: 'Incoming requests', i: 'message',  meta: <span style={{ display: 'inline-flex', padding: '1px 6px', borderRadius: 999, background: t.primary, color: '#fff', fontSize: 10, fontWeight: 700 }}>3</span> },
              { l: 'Saved toys',       i: 'heart',   meta: '8' },
            ].map((row, i, arr) => (
              <div key={i} style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: i < arr.length - 1 ? `1px solid ${t.border}` : 'none' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: t.primarySoft, display: 'grid', placeItems: 'center' }}>
                  <Icon name={row.i} size={16} color={t.primary} />
                </div>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: t.text }}>{row.l}</span>
                <span style={{ fontSize: 11.5, color: t.textMute }}>{row.meta}</span>
                <Icon name="chevron" size={15} color={t.textMute} />
              </div>
            ))}
          </div>

          <div style={{ background: t.surface, borderRadius: 14, border: `1px solid ${t.border}`, overflow: 'hidden', marginBottom: 14 }}>
            {[
              { l: 'Earnings & payouts', i: 'tag' },
              { l: 'Verification & ID',  i: 'shield', badge: <Badge tone="success" dir="A">Verified</Badge> },
              { l: 'Notifications',       i: 'bell' },
              { l: 'Language',            i: 'glob', meta: 'English' },
            ].map((row, i, arr) => (
              <div key={i} style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: i < arr.length - 1 ? `1px solid ${t.border}` : 'none' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: t.surfaceAlt, display: 'grid', placeItems: 'center' }}>
                  <Icon name={row.i} size={16} color={t.text} />
                </div>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: t.text }}>{row.l}</span>
                {row.badge}
                {row.meta && <span style={{ fontSize: 11.5, color: t.textMute }}>{row.meta}</span>}
                <Icon name="chevron" size={15} color={t.textMute} />
              </div>
            ))}
          </div>

          <div style={{ background: t.surface, borderRadius: 14, border: `1px solid ${t.border}`, overflow: 'hidden' }}>
            {[
              { l: 'Help center',  i: 'message' },
              { l: 'Privacy & terms', i: 'lock' },
              { l: 'Sign out', i: 'arrow', danger: true },
            ].map((row, i, arr) => (
              <div key={i} style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: i < arr.length - 1 ? `1px solid ${t.border}` : 'none' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: row.danger ? '#FFE8E5' : t.surfaceAlt, display: 'grid', placeItems: 'center' }}>
                  <Icon name={row.i} size={16} color={row.danger ? t.danger : t.text} />
                </div>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: row.danger ? t.danger : t.text }}>{row.l}</span>
                {!row.danger && <Icon name="chevron" size={15} color={t.textMute} />}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 18, textAlign: 'center', fontSize: 10.5, color: t.textMute }}>DoRent · v2.4.1</div>
        </div>
      </div>
      <FANav active={4} />
    </MScreen>
  );
}

// =====================================================
// 7. LISTINGS (BROWSE) EMPTY STATE — no results found
// =====================================================
function FAListingsEmpty() {
  const t = TOKENS.A;
  return (
    <MScreen dir="A" bg={t.bg}>
      <div style={{ background: t.surface, borderBottom: `1px solid ${t.border}`, padding: '10px 12px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button style={{ width: 40, height: 40, borderRadius: 999, background: 'transparent', display: 'grid', placeItems: 'center', border: 0 }}>
            <Icon name="chevronL" size={20} color={t.text} />
          </button>
          <div style={{ flex: 1, height: 40, borderRadius: 12, background: t.surfaceAlt, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8 }}>
            <Icon name="search" size={15} color={t.textMute} />
            <span style={{ flex: 1, fontSize: 13, color: t.text, fontWeight: 500 }}>trampoline</span>
            <Icon name="x" size={13} color={t.textMute} />
          </div>
          <button style={{ width: 40, height: 40, borderRadius: 12, background: t.primary, display: 'grid', placeItems: 'center', border: 0 }}>
            <Icon name="filter" size={17} color="#fff" />
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6, overflow: 'hidden', marginTop: 12 }}>
          <span style={{ padding: '6px 12px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: t.primarySoft, color: t.primary, display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>2–5 yrs <Icon name="x" size={10} color={t.primary} /></span>
          <span style={{ padding: '6px 12px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: t.primarySoft, color: t.primary, display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>Under ₽2,000 <Icon name="x" size={10} color={t.primary} /></span>
          <span style={{ padding: '6px 12px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: t.primarySoft, color: t.primary, display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>Within 3 km <Icon name="x" size={10} color={t.primary} /></span>
        </div>
      </div>

      <div style={{
        height: `calc(100% - ${FA_HEADER_H + 50}px - ${FA_NAV_H + FA_NAV_PAD}px)`,
        padding: '40px 24px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
      }}>
        <div style={{ width: 96, height: 96, borderRadius: 28, background: t.surfaceAlt, display: 'grid', placeItems: 'center', marginBottom: 16, position: 'relative' }}>
          <Icon name="search" size={42} color={t.textMute} />
          <div style={{ position: 'absolute', top: 0, right: -4, fontSize: 28 }}>🤷</div>
        </div>
        <h2 style={{ margin: '8px 0 6px', fontSize: 19, fontWeight: 800, color: t.text, letterSpacing: '-0.01em' }}>
          No toys match "trampoline"
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: t.textMute, lineHeight: 1.5, maxWidth: 280 }}>
          Try broader filters, or let us notify you when one is listed nearby.
        </p>

        <div style={{ marginTop: 20, display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button style={{ height: 40, padding: '0 16px', background: t.surface, color: t.text, borderRadius: 999, border: `1.5px solid ${t.border}`, fontSize: 13, fontWeight: 700 }}>Clear filters</button>
          <button style={{ height: 40, padding: '0 16px', background: t.text, color: '#fff', borderRadius: 999, border: 0, fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon name="bell" size={14} color="#fff" /> Notify me
          </button>
        </div>

        {/* Suggestions */}
        <div style={{ marginTop: 32, width: '100%', textAlign: 'left' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.textMute, letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 10 }}>Try instead</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['Ride-on toys', 'Scooters', 'Big-wheel cars', 'Outdoor play'].map((s, i) => (
              <span key={i} style={{ padding: '8px 14px', borderRadius: 999, background: t.surface, border: `1px solid ${t.border}`, fontSize: 12, fontWeight: 600, color: t.text }}>{s}</span>
            ))}
          </div>
        </div>
      </div>
      <FANav active={1} />
    </MScreen>
  );
}

// =====================================================
// 8. BOOKING ERROR STATE — payment / availability fail
// =====================================================
function FABookingError() {
  const t = TOKENS.A;
  return (
    <MScreen dir="A" bg={t.bg}>
      <FATopBar back title="Booking" />
      <div style={{
        height: `calc(100% - ${FA_HEADER_H}px)`,
        overflow: 'hidden', padding: '24px 20px',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Error illustration */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', paddingTop: 24 }}>
          <div style={{ width: 88, height: 88, borderRadius: 999, background: '#FFE8E5', display: 'grid', placeItems: 'center', marginBottom: 16, position: 'relative' }}>
            <div style={{ position: 'absolute', inset: -8, borderRadius: 999, border: `2px dashed ${t.danger}`, opacity: .3 }} />
            <Icon name="x" size={40} color={t.danger} strokeWidth={2.5} />
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: t.text, letterSpacing: '-0.02em' }}>Booking couldn't be sent</h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: t.textMute, lineHeight: 1.5, maxWidth: 290 }}>
            Anna's toy just got booked by another renter for these dates. Pick different days or browse similar toys.
          </p>
        </div>

        {/* Affected toy */}
        <div style={{ marginTop: 24, padding: 12, background: t.surface, borderRadius: 14, border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={TOY_IMGS.lego} style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>LEGO Duplo Town Set</div>
            <div style={{ fontSize: 11, color: t.textMute, marginTop: 2 }}>Requested: 18 – 22 May</div>
          </div>
          <Badge tone="warn" dir="A">Conflict</Badge>
        </div>

        {/* Alternatives */}
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 10 }}>Similar toys available now</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FAListingCard img={TOY_IMGS.blocks} title="LEGO Classic 484pcs" city="Arabkir" price="₽1,200" age="4–8 yr" verified />
            <FAListingCard img={TOY_IMGS.baby} title="LEGO Duplo Animals" city="Aurora" price="₽700" age="1–3 yr" verified />
          </div>
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 18, display: 'flex', gap: 10 }}>
          <button style={{ flex: 1, height: 48, background: t.surface, color: t.text, borderRadius: 999, border: `1.5px solid ${t.border}`, fontSize: 13, fontWeight: 700 }}>Pick new dates</button>
          <button style={{ flex: 1, height: 48, background: t.primary, color: '#fff', borderRadius: 999, border: 0, fontSize: 13, fontWeight: 700 }}>Browse similar</button>
        </div>
      </div>
    </MScreen>
  );
}

Object.assign(window, {
  FACreateListing, FAMyBookings, FABookingDetail,
  FAIncomingRequests, FAAdminModeration, FAProfile,
  FAListingsEmpty, FABookingError,
});
