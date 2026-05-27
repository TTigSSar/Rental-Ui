// flow-a-mvp-final.jsx — Final MVP-ready refinement pass
// Adds: full 5-step create wizard, booking declined/cancelled states,
// profile with Incoming Requests, admin reject with "Other" reason,
// responsive validation board (375 / 390 / 414 / 768 / 1280).

// =====================================================
// Helpers — shared between new create wizard steps
// =====================================================
function FAWizardHeader({ step, total = 5, label }) {
  const t = TOKENS.A;
  return (
    <div style={{ background: t.surface, borderBottom: `1px solid ${t.border}`, padding: '12px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <button style={{ width: 36, height: 36, borderRadius: 999, background: 'transparent', border: 0, display: 'grid', placeItems: 'center' }}>
          <Icon name="chevronL" size={20} color={t.text} />
        </button>
        <div style={{ textAlign: 'center', lineHeight: 1.2 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: t.textMute, letterSpacing: '.04em', textTransform: 'uppercase' }}>Step {step + 1} of {total}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{label}</div>
        </div>
        <button style={{ background: 'transparent', border: 0, fontSize: 12.5, fontWeight: 600, color: t.textMute }}>Save</button>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {Array.from({ length: total }, (_, i) => (
          <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= step ? t.primary : t.surfaceAlt }} />
        ))}
      </div>
    </div>
  );
}

function FAWizardFooter({ primaryLabel = 'Continue', back = true, primaryDark }) {
  const t = TOKENS.A;
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: t.surface, borderTop: `1px solid ${t.border}`,
      padding: '12px 16px 24px',
      display: 'flex', gap: 10,
    }}>
      {back && <button style={{ flex: 1, height: 48, background: t.surface, color: t.text, borderRadius: 999, border: `1.5px solid ${t.border}`, fontSize: 14, fontWeight: 700 }}>Back</button>}
      <button style={{ flex: 1.5, height: 48, background: primaryDark ? t.text : t.primary, color: '#fff', borderRadius: 999, border: 0, fontSize: 14, fontWeight: 700 }}>
        {primaryLabel}
      </button>
    </div>
  );
}

// =====================================================
// 1. CREATE LISTING · Step 1 · Photos
// =====================================================
function FACreatePhotos() {
  const t = TOKENS.A;
  return (
    <MScreen dir="A" bg={t.bg}>
      <FAWizardHeader step={0} label="Photos" />
      <div style={{ height: `calc(100% - 86px - 84px)`, overflow: 'hidden', padding: '18px 16px' }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: t.text, letterSpacing: '-0.02em' }}>Show your toy</h1>
        <p style={{ margin: '4px 0 18px', fontSize: 13, color: t.textMute }}>Bright daylight, clean background, all parts visible.</p>

        {/* First slot — big, dashed primary */}
        <div style={{
          aspectRatio: '4/3', borderRadius: 16, marginBottom: 12,
          background: t.primarySoft, border: `1.5px dashed ${t.primary}`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: '#fff', display: 'grid', placeItems: 'center' }}>
            <Icon name="camera" size={26} color={t.primary} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Add cover photo</div>
          <div style={{ fontSize: 11, color: t.textMute }}>This shows first in search results</div>
        </div>

        {/* Secondary slots — 3 cols */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[0,1,2,3,4].map(i => (
            <button key={i} style={{
              aspectRatio: '1/1', borderRadius: 12,
              background: t.surface, border: `1.5px dashed ${t.border}`,
              display: 'grid', placeItems: 'center',
            }}>
              <Icon name="plus" size={18} color={t.textMute} />
            </button>
          ))}
        </div>

        {/* Tips */}
        <div style={{ marginTop: 16, padding: 12, background: t.surface, borderRadius: 12, border: `1px solid ${t.border}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.textMute, letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 6 }}>Tips</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: t.text, lineHeight: 1.6 }}>
            <li>3+ photos · max 8</li>
            <li>Include any wear, scratches or damage</li>
            <li>Show packaging or all pieces if it's a set</li>
          </ul>
        </div>
      </div>
      <FAWizardFooter primaryLabel="Continue to basics" back={false} />
    </MScreen>
  );
}

// =====================================================
// 2. CREATE LISTING · Step 3 · Pricing & Location (NEW)
// =====================================================
function FACreatePricing() {
  const t = TOKENS.A;
  return (
    <MScreen dir="A" bg={t.bg}>
      <FAWizardHeader step={2} label="Pricing & Location" />
      <div style={{ height: `calc(100% - 86px - 84px)`, overflow: 'hidden', padding: '18px 16px' }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: t.text, letterSpacing: '-0.02em' }}>How much per day?</h1>
        <p style={{ margin: '4px 0 18px', fontSize: 13, color: t.textMute }}>You earn ~85% after our 15% service fee.</p>

        <div style={{ display: 'grid', gap: 14 }}>
          {/* Price field with big hero number */}
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: t.text }}>Daily price</label>
            <div style={{ height: 76, padding: '0 14px 0 0', borderRadius: 16, background: t.surface, border: `1.5px solid ${t.primary}`, boxShadow: `0 0 0 4px ${t.primary}1A`, display: 'flex', alignItems: 'center' }}>
              <span style={{ height: '100%', padding: '0 18px', borderRight: `1px solid ${t.border}`, display: 'inline-flex', alignItems: 'center', fontSize: 22, fontWeight: 700, color: t.textMute }}>₽</span>
              <span style={{ flex: 1, padding: '0 16px', fontSize: 28, fontWeight: 800, color: t.text, letterSpacing: '-0.02em' }}>1,500</span>
              <span style={{ paddingRight: 16, fontSize: 13, color: t.textMute, fontWeight: 500 }}>/ day</span>
            </div>
            <div style={{ marginTop: 6, padding: '8px 10px', background: t.primarySoft, borderRadius: 8, fontSize: 11.5, color: t.text, lineHeight: 1.5, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="sparkle" size={12} color={t.primary} />
              <span><strong>Suggested:</strong> ₽1,200 – ₽1,800 / day for LEGO Duplo near Kentron.</span>
            </div>
          </div>

          {/* Min rental days */}
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: t.text }}>Minimum rental</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {['1 day', '3 days', '1 week', '2 weeks'].map((d, i) => (
                <span key={i} style={{
                  flex: 1, height: 40, borderRadius: 999,
                  background: i === 1 ? t.text : t.surface,
                  color: i === 1 ? '#fff' : t.text,
                  border: i === 1 ? 'none' : `1px solid ${t.border}`,
                  display: 'grid', placeItems: 'center',
                  fontSize: 12, fontWeight: 600,
                }}>{d}</span>
              ))}
            </div>
          </div>

          {/* Location */}
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: t.text }}>Pickup area</label>
            <div style={{ height: 48, padding: '0 14px', borderRadius: 14, background: t.surface, border: `1.5px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Icon name="pin" size={17} color={t.primary} />
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: t.text }}>Kentron, Yerevan</span>
              <Icon name="chevronD" size={15} color={t.textMute} />
            </div>
            <div style={{ marginTop: 4, fontSize: 11, color: t.textMute }}>We only show your district to renters — never your full address.</div>
          </div>

          {/* Pickup / delivery options */}
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: t.text }}>How can renters get the toy?</label>
            <div style={{ display: 'grid', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, background: t.surface, borderRadius: 12, border: `1.5px solid ${t.primary}` }}>
                <div style={{ width: 20, height: 20, borderRadius: 999, border: `2px solid ${t.primary}`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 999, background: t.primary }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Pickup from me</div>
                  <div style={{ fontSize: 11, color: t.textMute, marginTop: 1 }}>Free · meet at agreed spot</div>
                </div>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, background: t.surface, borderRadius: 12, border: `1px solid ${t.border}` }}>
                <div style={{ width: 20, height: 20, borderRadius: 999, border: `2px solid ${t.border}`, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Courier delivery</div>
                  <div style={{ fontSize: 11, color: t.textMute, marginTop: 1 }}>Renter pays · ~₽600 in Yerevan</div>
                </div>
              </label>
            </div>
          </div>
        </div>
      </div>
      <FAWizardFooter primaryLabel="Continue to safety" />
    </MScreen>
  );
}

// =====================================================
// 3. CREATE LISTING · Step 4 · Safety & Hygiene (NEW)
// =====================================================
function FACreateSafety() {
  const t = TOKENS.A;
  return (
    <MScreen dir="A" bg={t.bg}>
      <FAWizardHeader step={3} label="Safety & Hygiene" />
      <div style={{ height: `calc(100% - 86px - 84px)`, overflow: 'hidden', padding: '18px 16px' }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: t.text, letterSpacing: '-0.02em' }}>Keep families safe</h1>
        <p style={{ margin: '4px 0 18px', fontSize: 13, color: t.textMute }}>Parents look here before booking. Be honest.</p>

        <div style={{ display: 'grid', gap: 14 }}>
          {/* Cleaning checklist */}
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 12, fontWeight: 600, color: t.text }}>Cleaning between rentals</label>
            <div style={{ background: t.surface, borderRadius: 14, border: `1px solid ${t.border}`, overflow: 'hidden' }}>
              {[
                { l: 'Washed with soap & water', sub: 'Soft toys & washable items', checked: true },
                { l: 'Disinfected with safe wipes', sub: 'Hard plastics & wood',     checked: true },
                { l: 'UV-sanitized',              sub: 'Small parts & figures',     checked: false },
              ].map((row, i, arr) => (
                <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: i < arr.length - 1 ? `1px solid ${t.border}` : 'none' }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 6,
                    background: row.checked ? t.primary : 'transparent',
                    border: `1.5px solid ${row.checked ? t.primary : t.border}`,
                    display: 'grid', placeItems: 'center', flexShrink: 0,
                  }}>
                    {row.checked && <Icon name="check" size={13} color="#fff" strokeWidth={3} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{row.l}</div>
                    <div style={{ fontSize: 11, color: t.textMute, marginTop: 1 }}>{row.sub}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Condition notes */}
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: t.text }}>Any wear or missing pieces?</label>
            <div style={{ minHeight: 88, padding: '12px 14px', borderRadius: 14, background: t.surface, border: `1.5px solid ${t.border}`, fontSize: 13, color: t.text, lineHeight: 1.55 }}>
              Slight wear on 2 mini-figure heads. All 124 pieces accounted for. Box is original but corners are bent.
            </div>
            <div style={{ marginTop: 4, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: t.textMute }}>
              <span>Optional — but reduces complaints &amp; refund requests.</span>
              <span>118 / 300</span>
            </div>
          </div>

          {/* Age guidance lock */}
          <div style={{ padding: 12, background: t.surface, borderRadius: 12, border: `1px solid ${t.border}`, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <Icon name="shield" size={18} color={t.success} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: t.text }}>I confirm this toy is safe for ages 2–5</div>
              <div style={{ fontSize: 11, color: t.textMute, marginTop: 2, lineHeight: 1.45 }}>No choking hazards, no recalled items, no broken parts.</div>
            </div>
            <div style={{ width: 36, height: 22, borderRadius: 999, background: t.success, padding: 2, display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
              <div style={{ width: 18, height: 18, borderRadius: 999, background: '#fff' }} />
            </div>
          </div>
        </div>
      </div>
      <FAWizardFooter primaryLabel="Continue to preview" />
    </MScreen>
  );
}

// =====================================================
// 4. CREATE LISTING · Step 5 · Preview & Submit (NEW)
// =====================================================
function FACreatePreview() {
  const t = TOKENS.A;
  return (
    <MScreen dir="A" bg={t.bg}>
      <FAWizardHeader step={4} label="Preview & Submit" />
      <div style={{ height: `calc(100% - 86px - 84px)`, overflow: 'hidden', padding: '18px 16px 12px' }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: t.text, letterSpacing: '-0.02em' }}>How renters will see it</h1>
        <p style={{ margin: '4px 0 18px', fontSize: 13, color: t.textMute }}>Goes live within 4 hours after we review.</p>

        {/* Preview card */}
        <div style={{ background: t.surface, borderRadius: 16, border: `1px solid ${t.border}`, overflow: 'hidden', marginBottom: 14 }}>
          <div style={{ position: 'relative', aspectRatio: '4/3', background: t.surfaceAlt }}>
            <img src={TOY_IMGS.lego} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', bottom: 10, left: 10, background: 'rgba(255,255,255,.95)', padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, color: t.text }}>2–5 yr</div>
          </div>
          <div style={{ padding: 14 }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
              <Badge tone="success" dir="A"><Icon name="verified" size={11} color={t.success}/> Verified</Badge>
              <Badge tone="info" dir="A"><Icon name="clean" size={11}/> Hygiene checked</Badge>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>LEGO Duplo Town Set</div>
            <div style={{ fontSize: 11, color: t.textMute, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Icon name="pin" size={11} color={t.textMute} /> Kentron · pickup
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginTop: 8 }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: t.primary }}>₽1,500</span>
              <span style={{ fontSize: 11, color: t.textMute }}>/ day · min 3 days</span>
            </div>
          </div>
        </div>

        {/* Summary rows */}
        <div style={{ background: t.surface, borderRadius: 14, border: `1px solid ${t.border}`, overflow: 'hidden' }}>
          {[
            { l: 'Category',     v: 'LEGO & Bricks',        edit: 1 },
            { l: 'Age',          v: '2–5 yr',               edit: 1 },
            { l: 'Photos',       v: '3 added',              edit: 0 },
            { l: 'Daily price',  v: '₽1,500',               edit: 2 },
            { l: 'Pickup',       v: 'Kentron, Yerevan',     edit: 2 },
            { l: 'Safety',       v: '2 of 3 cleaning steps',edit: 3 },
          ].map((row, i, arr) => (
            <div key={i} style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: i < arr.length - 1 ? `1px solid ${t.border}` : 'none' }}>
              <span style={{ width: 90, fontSize: 11.5, color: t.textMute }}>{row.l}</span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: t.text }}>{row.v}</span>
              <button style={{ fontSize: 11.5, fontWeight: 700, color: t.primary, background: 'transparent', border: 0 }}>Edit</button>
            </div>
          ))}
        </div>

        {/* Agreement */}
        <div style={{ marginTop: 12, padding: 12, background: t.bg, borderRadius: 12, border: `1px dashed ${t.border}`, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ width: 20, height: 20, borderRadius: 6, background: t.primary, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Icon name="check" size={13} color="#fff" strokeWidth={3} />
          </div>
          <div style={{ flex: 1, fontSize: 11.5, color: t.text, lineHeight: 1.5 }}>
            I agree to ToyRent's <span style={{ color: t.primary, fontWeight: 700 }}>community rules</span> and confirm this listing is accurate.
          </div>
        </div>
      </div>
      <FAWizardFooter primaryLabel="Submit for review" primaryDark={false} />
    </MScreen>
  );
}

// =====================================================
// 5. BOOKING DECLINED STATE (NEW)
// =====================================================
function FABookingDeclined() {
  const t = TOKENS.A;
  return (
    <MScreen dir="A" bg={t.bg}>
      <FATopBar back title="Booking #4821" />
      <div style={{
        height: `calc(100% - ${FA_HEADER_H}px - ${FA_NAV_H + FA_NAV_PAD}px)`,
        overflow: 'hidden', padding: '20px 16px',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', padding: '8px 0 18px' }}>
          <div style={{ width: 80, height: 80, borderRadius: 22, background: '#FFE8E5', display: 'grid', placeItems: 'center', margin: '0 auto 14px' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={t.danger} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M9 9l6 6M15 9l-6 6" />
            </svg>
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: t.text, letterSpacing: '-0.02em' }}>Anna declined your request</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: t.textMute, lineHeight: 1.5, maxWidth: 300, marginLeft: 'auto', marginRight: 'auto' }}>
            You haven't been charged. Don't worry — there are similar toys available right now.
          </p>
        </div>

        {/* Reason */}
        <div style={{ padding: 14, background: t.surface, borderRadius: 14, border: `1px solid ${t.border}`, marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.textMute, letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 6 }}>Reason</div>
          <div style={{ fontSize: 13, color: t.text, lineHeight: 1.5 }}>
            "Sorry — those dates clash with a family trip. Could you try the following week? I'd be happy to host then."
          </div>
        </div>

        {/* Original request summary */}
        <div style={{ padding: 12, background: t.surface, borderRadius: 14, border: `1px solid ${t.border}`, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={TOY_IMGS.lego} style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>LEGO Duplo Town Set</div>
            <div style={{ fontSize: 11, color: t.textMute, marginTop: 2 }}>18 – 22 May · ₽7,300 (refunded)</div>
          </div>
        </div>

        {/* Alternatives */}
        <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: t.text }}>Similar toys you can book now</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <FAListingCard img={TOY_IMGS.blocks} title="LEGO Classic 484pcs" city="Arabkir" price="₽1,200" age="4–8 yr" verified />
          <FAListingCard img={TOY_IMGS.baby} title="LEGO Duplo Animals" city="Aurora" price="₽700" age="1–3 yr" verified />
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 16, display: 'flex', gap: 10 }}>
          <button style={{ flex: 1, height: 48, background: t.surface, color: t.text, borderRadius: 999, border: `1.5px solid ${t.border}`, fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Icon name="message" size={14} color={t.text} /> Message Anna
          </button>
          <button style={{ flex: 1, height: 48, background: t.primary, color: '#fff', borderRadius: 999, border: 0, fontSize: 13, fontWeight: 700 }}>
            Browse toys
          </button>
        </div>
      </div>
      <FANav active={3} />
    </MScreen>
  );
}

// =====================================================
// 6. BOOKING CANCELLED STATE (NEW)
// =====================================================
function FABookingCancelled() {
  const t = TOKENS.A;
  return (
    <MScreen dir="A" bg={t.bg}>
      <FATopBar back title="Booking #4821" />
      <div style={{
        height: `calc(100% - ${FA_HEADER_H}px - ${FA_NAV_H + FA_NAV_PAD}px)`,
        overflow: 'hidden', padding: '20px 16px',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', padding: '8px 0 18px' }}>
          <div style={{ width: 80, height: 80, borderRadius: 22, background: t.surfaceAlt, display: 'grid', placeItems: 'center', margin: '0 auto 14px' }}>
            <Icon name="x" size={40} color={t.textMute} strokeWidth={2.2} />
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: t.text, letterSpacing: '-0.02em' }}>Booking cancelled</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: t.textMute, lineHeight: 1.5, maxWidth: 300, marginLeft: 'auto', marginRight: 'auto' }}>
            You cancelled this rental on 16 May. A full refund is on its way to your card.
          </p>
        </div>

        {/* Refund summary */}
        <div style={{ padding: 14, background: '#E6F4EE', borderRadius: 14, border: `1px solid ${t.success}30`, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: t.success, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Icon name="check" size={18} color="#fff" strokeWidth={3} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>₽7,300 refund issued</div>
            <div style={{ fontSize: 11, color: t.textMute, marginTop: 2 }}>To Visa •••• 4821 · arrives in 3–5 business days</div>
          </div>
        </div>

        {/* Booking summary */}
        <div style={{ padding: 14, background: t.surface, borderRadius: 14, border: `1px solid ${t.border}`, marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.textMute, letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 10 }}>Cancelled booking</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src={TOY_IMGS.lego} style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover', opacity: .7 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>LEGO Duplo Town Set</div>
              <div style={{ fontSize: 11, color: t.textMute, marginTop: 2 }}>Was: 18 – 22 May · Anna · Kentron</div>
            </div>
          </div>
        </div>

        {/* Next steps */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.textMute, letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 10 }}>What's next?</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {[
              { i: 'grid',     l: 'Browse more toys nearby' },
              { i: 'calendar', l: 'Re-book Anna for different dates' },
              { i: 'message',  l: 'Contact support if anything went wrong' },
            ].map((step, i) => (
              <button key={i} style={{
                padding: 12, background: t.surface, borderRadius: 12, border: `1px solid ${t.border}`,
                display: 'flex', alignItems: 'center', gap: 12,
                cursor: 'pointer', width: '100%',
              }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: t.primarySoft, display: 'grid', placeItems: 'center' }}>
                  <Icon name={step.i} size={16} color={t.primary} />
                </div>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: t.text, textAlign: 'left' }}>{step.l}</span>
                <Icon name="chevron" size={15} color={t.textMute} />
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 6 }}>
          <button style={{ width: '100%', height: 48, background: t.primary, color: '#fff', borderRadius: 999, border: 0, fontSize: 14, fontWeight: 700 }}>
            Browse toys
          </button>
        </div>
      </div>
      <FANav active={3} />
    </MScreen>
  );
}

// =====================================================
// 7. PROFILE MVP v2 — with Incoming Requests row
// =====================================================
function FAProfileMVPv2() {
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
        {/* Identity */}
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

          {/* Identity rows */}
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

        {/* Primary actions — now includes Incoming Requests */}
        <div style={{ padding: '14px 16px 0' }}>
          <div style={{ background: t.surface, borderRadius: 14, border: `1px solid ${t.border}`, overflow: 'hidden' }}>
            <MenuRow icon="grid"     label="My toys"     meta="5 listings" />
            <MenuRow icon="calendar" label="My rentals"  meta="2 upcoming" />
            <MenuRow icon="message"  label="Incoming requests"
              badge={<span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 20, height: 20, padding: '0 6px', borderRadius: 999, background: t.primary, color: '#fff', fontSize: 11, fontWeight: 700 }}>3</span>} />
            <MenuRow icon="heart"    label="Saved toys"  meta="8" last />
          </div>
        </div>

        {/* Settings + Support */}
        <div style={{ padding: '14px 16px 0' }}>
          <div style={{ background: t.surface, borderRadius: 14, border: `1px solid ${t.border}`, overflow: 'hidden' }}>
            <MenuRow icon="glob"    label="Language" meta="English" />
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
// 8. ADMIN REJECT SHEET v2 — adds "Other" reason
// =====================================================
function FAAdminRejectV2() {
  const t = TOKENS.A;
  const reasons = [
    { l: 'Poor images',           sub: 'Blurry, dark, or too few photos',     icon: 'image' },
    { l: 'Missing information',   sub: 'Incomplete title or description',     icon: 'flag' },
    { l: 'Wrong category',        sub: 'Listed under incorrect category',     icon: 'tag' },
    { l: 'Unsafe item',           sub: 'Choking hazard, recalled, broken',    icon: 'shield' },
    { l: 'Duplicate listing',     sub: 'Same toy already exists',             icon: 'grid' },
    { l: 'Inappropriate content', sub: 'Violates community guidelines',       icon: 'x' },
    { l: 'Other',                 sub: 'Add a custom note below',             icon: 'flag', sel: true },
  ];
  return (
    <MScreen dir="A" bg="rgba(15,17,21,.45)">
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,17,21,.55)' }} />
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        background: t.surface, borderRadius: '24px 24px 0 0',
        padding: '12px 16px 24px',
        boxShadow: '0 -20px 40px rgba(0,0,0,.2)',
        animation: 'fa-slide-up .25s cubic-bezier(.2,.7,.3,1)',
        maxHeight: '92%', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ width: 40, height: 4, background: t.border, borderRadius: 4, margin: '0 auto 14px' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: t.text, letterSpacing: '-0.01em' }}>Reject listing</h2>
          <button style={{ width: 32, height: 32, borderRadius: 999, background: t.surfaceAlt, border: 0, display: 'grid', placeItems: 'center' }}>
            <Icon name="x" size={15} color={t.text} />
          </button>
        </div>
        <p style={{ margin: '2px 0 12px', fontSize: 12, color: t.textMute, lineHeight: 1.5 }}>
          Anna will see the reason — pick one she can act on.
        </p>

        <div style={{ flex: 1, overflow: 'hidden', display: 'grid', gap: 6, alignContent: 'start', marginBottom: 12 }}>
          {reasons.map((r, i) => (
            <label key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px',
              background: r.sel ? t.primarySoft : t.bg,
              border: r.sel ? `1.5px solid ${t.primary}` : `1px solid ${t.border}`,
              borderRadius: 12,
              cursor: 'pointer',
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
            </label>
          ))}
        </div>

        {/* Note required when Other selected */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6, fontSize: 12, fontWeight: 600, color: t.text }}>
            Moderator note <span style={{ color: t.danger }}>*</span>
          </label>
          <div style={{ minHeight: 64, padding: '10px 12px', borderRadius: t.radius, background: t.surface, border: `1.5px solid ${t.primary}`, boxShadow: `0 0 0 4px ${t.primary}1A`, fontSize: 13, color: t.text, lineHeight: 1.5 }}>
            Photos look like AI-generated stock, not the actual toy. Please re-upload real photos.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button style={{ flex: 1, height: 48, background: t.surface, color: t.text, borderRadius: 999, border: `1.5px solid ${t.border}`, fontSize: 14, fontWeight: 700 }}>Cancel</button>
          <button style={{ flex: 1.5, height: 48, background: t.danger, color: '#fff', borderRadius: 999, border: 0, fontSize: 14, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Icon name="x" size={14} color="#fff" strokeWidth={2.5} /> Reject listing
          </button>
        </div>
      </div>
    </MScreen>
  );
}

// =====================================================
// MVP READINESS CHECKLIST BOARD
// =====================================================
function FAMVPReadinessBoard() {
  const t = TOKENS.A;
  const Row = ({ area, status, note }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 100px 1fr', gap: 12, padding: '10px 0', borderBottom: `1px solid ${t.border}`, alignItems: 'baseline' }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{area}</span>
      <span>
        {status === 'done' && <Badge tone="success" dir="A">✓ Done</Badge>}
        {status === 'new'  && <Badge tone="primary" dir="A">+ New</Badge>}
        {status === 'updated' && <Badge tone="info" dir="A">↑ Updated</Badge>}
      </span>
      <span style={{ fontSize: 12, color: t.textMute, lineHeight: 1.55 }}>{note}</span>
    </div>
  );
  return (
    <div style={{ width: 1480, background: '#fff', borderRadius: 12, padding: 32, border: `1px solid ${t.border}` }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', color: t.primary, textTransform: 'uppercase' }}>MVP Readiness</div>
        <h2 style={{ margin: '4px 0 6px', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>Implementation-ready checklist</h2>
        <p style={{ margin: 0, fontSize: 13, color: t.textMute, maxWidth: 760, lineHeight: 1.55 }}>
          Audit of the refinement request against what exists in the canvas now. Goal: ship the first 10 successful rentals.
        </p>
      </div>

      <Row area="Create listing · 5 steps" status="updated"
        note="Photos / Basics / Pricing &amp; Location / Safety &amp; Hygiene / Preview &amp; Submit. Progress bar across all 5. Save draft in header." />
      <Row area="Owner Request Details" status="done"
        note="See Section 18 · 5 · Owner · view request. Renter preview, message, summary, sticky Decline/Accept." />
      <Row area="Admin Reject Flow" status="updated"
        note="See Section 20 · v2: now includes 'Other' reason with required moderator note." />
      <Row area="Booking Declined State" status="new"
        note="Reason, original toy summary (refunded), 2 similar toys grid, Message owner / Browse CTAs. No dead end." />
      <Row area="Booking Cancelled State" status="new"
        note="Refund confirmation banner, cancelled-booking summary, 3 next-step rows, Browse toys CTA." />
      <Row area="Review System" status="done"
        note="See Section 19. Renter→Owner (4 criteria), Owner→Renter (3 criteria), success state, profile + listing aggregates." />
      <Row area="Profile Refinement" status="updated"
        note="See Section 20 · v2: now Name/Phone/Email block + 4 primary actions including Incoming Requests · Language · Help · Logout." />
      <Row area="Saved Toys + empty" status="done"
        note="See Section 18 · 2a/2b. Same card system, long-press hint, friendly empty state with Browse CTA." />
      <Row area="My Toys Empty State" status="done"
        note="See Section 18 · 3. 3-row benefit list, 'List your first toy' CTA, '2-minute' reassurance." />
      <Row area="Consistency pass" status="done"
        note="See Section 18 · 6. Single-source-of-truth table for heights, spacing, radius, type, shadow." />

      <div style={{ marginTop: 24, padding: 18, background: t.bg, borderRadius: 14, border: `1px dashed ${t.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Icon name="check" size={16} color={t.success} strokeWidth={3} />
          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Final acceptance criteria</h4>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, fontSize: 12, color: t.text, lineHeight: 1.55 }}>
          {[
            { t: 'Trust', d: 'Every card shows owner identity + verification. Phone unlocks only after booking request. Two-sided reviews aggregate on profile + listing.' },
            { t: 'Simplicity', d: 'No flow needs more than 5 steps. No screen has more than 1 primary action above the fold. Profile has 7 rows, not 14.' },
            { t: 'Operational realism', d: 'Owner inbox · accept/decline. Admin queue · approve/reject with reasons + note. Cancelled / declined are real screens, not browser errors.' },
            { t: 'Parent UX', d: 'Mobile-first 390px. 44px hit targets. Bottom nav clear of content. Inline (not sticky) booking panel. Safe bottom spacing across all screens.' },
          ].map((c, i) => (
            <div key={i}>
              <div style={{ fontWeight: 700, color: t.text, marginBottom: 4 }}>{c.t}</div>
              <div style={{ color: t.textMute }}>{c.d}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  FAWizardHeader, FAWizardFooter,
  FACreatePhotos, FACreatePricing, FACreateSafety, FACreatePreview,
  FABookingDeclined, FABookingCancelled,
  FAProfileMVPv2, FAAdminRejectV2,
  FAMVPReadinessBoard,
});
