// flow-a-reviews.jsx — Two-sided review system
// 1. Renter reviews owner   2. Owner reviews renter
// 3. Review success state   4. Profile with rating summary
// 5. Listing detail reviews section

// =====================================================
// Shared: StarRow — 5 tappable stars, selected count
// =====================================================
function StarRow({ value = 0, max = 5, size = 32 }) {
  const t = TOKENS.A;
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {Array.from({ length: max }, (_, i) => {
        const filled = i < value;
        return (
          <button key={i} style={{
            width: size, height: size, borderRadius: 999,
            background: 'transparent', border: 0, padding: 0,
            display: 'grid', placeItems: 'center', cursor: 'pointer',
          }}>
            <svg width={size - 6} height={size - 6} viewBox="0 0 24 24"
              fill={filled ? '#F2A900' : 'none'}
              stroke={filled ? '#F2A900' : t.border}
              strokeWidth="1.8" strokeLinejoin="round">
              <path d="M12 2l3 6.5 7 1-5 5 1.5 7-6.5-3.5L5.5 21 7 14 2 9l7-1L12 2z"/>
            </svg>
          </button>
        );
      })}
    </div>
  );
}

function CriterionRow({ label, helper, value }) {
  const t = TOKENS.A;
  const labels = ['Poor', 'Fair', 'Good', 'Great', 'Excellent'];
  return (
    <div style={{ padding: '12px 0', borderBottom: `1px solid ${t.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: t.text }}>{label}</div>
          {helper && <div style={{ fontSize: 11, color: t.textMute, marginTop: 2 }}>{helper}</div>}
        </div>
        {value > 0 && <span style={{ fontSize: 11.5, fontWeight: 700, color: t.primary }}>{labels[value - 1]}</span>}
      </div>
      <StarRow value={value} size={30} />
    </div>
  );
}

// =====================================================
// 1. RENTER REVIEWS OWNER
// =====================================================
function FARenterReview() {
  const t = TOKENS.A;
  return (
    <MScreen dir="A" bg={t.bg}>
      <FATopBar back title="Leave a review" />
      <div style={{
        height: `calc(100% - ${FA_HEADER_H}px)`,
        overflow: 'hidden',
        paddingBottom: 96, // sticky submit
      }}>
        <div style={{ padding: '16px 16px 18px' }}>
          {/* Owner being reviewed */}
          <div style={{ padding: 14, background: t.surface, borderRadius: 16, border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <img src={FAMILY_AVS.anna} style={{ width: 48, height: 48, borderRadius: 999, objectFit: 'cover' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: t.textMute, letterSpacing: '.04em', textTransform: 'uppercase' }}>Reviewing</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.text, display: 'flex', alignItems: 'center', gap: 4 }}>
                Anna Sargsyan <Icon name="verified" size={14} color={t.success} />
              </div>
              <div style={{ fontSize: 11, color: t.textMute, marginTop: 1 }}>LEGO Duplo Town · 18 – 22 May</div>
            </div>
          </div>

          {/* Overall rating */}
          <div style={{ padding: 18, background: t.surface, borderRadius: 16, border: `1px solid ${t.border}`, textAlign: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>How was your rental overall?</div>
            <div style={{ fontSize: 11, color: t.textMute, marginTop: 2, marginBottom: 14 }}>Tap to rate</div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <StarRow value={5} size={40} />
            </div>
            <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700, color: t.primary }}>Excellent</div>
          </div>

          {/* Criteria card */}
          <div style={{ padding: '4px 16px 0', background: t.surface, borderRadius: 16, border: `1px solid ${t.border}`, marginBottom: 14 }}>
            <CriterionRow label="Communication" helper="Replies, clarity, helpfulness" value={5} />
            <CriterionRow label="Toy condition" helper="Matched the listing description" value={5} />
            <CriterionRow label="Cleanliness" helper="Hygiene &amp; sanitation" value={4} />
            <CriterionRow label="Description accuracy" helper="What you got vs. what was listed" value={5} />
            <div style={{ height: 4 }} />
          </div>

          {/* Optional comment */}
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: t.text }}>
              Add a comment <span style={{ color: t.textMute, fontWeight: 500 }}>(optional)</span>
            </label>
            <div style={{ minHeight: 100, padding: '12px 14px', borderRadius: 14, background: t.surface, border: `1.5px solid ${t.border}`, fontSize: 13, color: t.text, lineHeight: 1.55 }}>
              Anna was super communicative — pickup was easy and the set was spotless. My son loved it!
            </div>
            <div style={{ marginTop: 4, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: t.textMute }}>
              <span>Reviews help other families pick safely.</span>
              <span>118 / 400</span>
            </div>
          </div>

          {/* Privacy hint */}
          <div style={{ marginTop: 14, padding: 12, background: t.bg, borderRadius: 12, border: `1px dashed ${t.border}`, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <Icon name="shield" size={15} color={t.textMute} />
            <div style={{ flex: 1, fontSize: 11, color: t.textMute, lineHeight: 1.5 }}>
              Reviews are public on Anna's profile. You can edit yours for 14 days.
            </div>
          </div>
        </div>
      </div>

      {/* Sticky submit */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: t.surface, borderTop: `1px solid ${t.border}`,
        padding: '12px 16px 24px',
        display: 'flex', gap: 10,
      }}>
        <button style={{ flex: 1, height: 48, background: t.surface, color: t.text, borderRadius: 999, border: `1.5px solid ${t.border}`, fontSize: 13, fontWeight: 700 }}>
          Skip
        </button>
        <button style={{ flex: 1.5, height: 48, background: t.primary, color: '#fff', borderRadius: 999, border: 0, fontSize: 14, fontWeight: 700 }}>
          Submit review
        </button>
      </div>
    </MScreen>
  );
}

// =====================================================
// 2. OWNER REVIEWS RENTER
// =====================================================
function FAOwnerReview() {
  const t = TOKENS.A;
  return (
    <MScreen dir="A" bg={t.bg}>
      <FATopBar back title="Rate the renter" />
      <div style={{
        height: `calc(100% - ${FA_HEADER_H}px)`,
        overflow: 'hidden',
        paddingBottom: 96,
      }}>
        <div style={{ padding: '16px 16px 18px' }}>
          {/* Renter being reviewed */}
          <div style={{ padding: 14, background: t.surface, borderRadius: 16, border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <img src={FAMILY_AVS.marina} style={{ width: 48, height: 48, borderRadius: 999, objectFit: 'cover' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: t.textMute, letterSpacing: '.04em', textTransform: 'uppercase' }}>Rating renter</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.text, display: 'flex', alignItems: 'center', gap: 4 }}>
                Marina Hovhannisyan <Icon name="verified" size={14} color={t.success} />
              </div>
              <div style={{ fontSize: 11, color: t.textMute, marginTop: 1 }}>Rented LEGO Duplo Town · returned today</div>
            </div>
          </div>

          {/* Overall */}
          <div style={{ padding: 18, background: t.surface, borderRadius: 16, border: `1px solid ${t.border}`, textAlign: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Would you rent to Marina again?</div>
            <div style={{ fontSize: 11, color: t.textMute, marginTop: 2, marginBottom: 14 }}>Tap to rate</div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <StarRow value={5} size={40} />
            </div>
            <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700, color: t.primary }}>Excellent</div>
          </div>

          {/* Criteria */}
          <div style={{ padding: '4px 16px 0', background: t.surface, borderRadius: 16, border: `1px solid ${t.border}`, marginBottom: 14 }}>
            <CriterionRow label="Communication" helper="Replies &amp; coordination around pickup" value={5} />
            <CriterionRow label="Returned on time" helper="At the agreed return time" value={5} />
            <CriterionRow label="Care of toy" helper="Returned in same condition" value={4} />
            <div style={{ height: 4 }} />
          </div>

          {/* Optional comment */}
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: t.text }}>
              Add a comment <span style={{ color: t.textMute, fontWeight: 500 }}>(optional)</span>
            </label>
            <div style={{ minHeight: 90, padding: '12px 14px', borderRadius: 14, background: t.surface, border: `1.5px solid ${t.border}`, fontSize: 13, color: t.text, lineHeight: 1.55 }}>
              Easy to coordinate, returned the set in great shape. Welcome anytime!
            </div>
            <div style={{ marginTop: 4, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: t.textMute }}>
              <span>Renters with good reviews get accepted faster.</span>
              <span>84 / 400</span>
            </div>
          </div>

          <div style={{ marginTop: 14, padding: 12, background: t.bg, borderRadius: 12, border: `1px dashed ${t.border}`, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <Icon name="lock" size={14} color={t.textMute} />
            <div style={{ flex: 1, fontSize: 11, color: t.textMute, lineHeight: 1.5 }}>
              Marina sees your review after she submits hers — so both stay honest.
            </div>
          </div>
        </div>
      </div>

      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: t.surface, borderTop: `1px solid ${t.border}`,
        padding: '12px 16px 24px',
        display: 'flex', gap: 10,
      }}>
        <button style={{ flex: 1, height: 48, background: t.surface, color: t.text, borderRadius: 999, border: `1.5px solid ${t.border}`, fontSize: 13, fontWeight: 700 }}>
          Skip
        </button>
        <button style={{ flex: 1.5, height: 48, background: t.primary, color: '#fff', borderRadius: 999, border: 0, fontSize: 14, fontWeight: 700 }}>
          Submit review
        </button>
      </div>
    </MScreen>
  );
}

// =====================================================
// 3. REVIEW SUCCESS STATE
// =====================================================
function FAReviewSuccess() {
  const t = TOKENS.A;
  return (
    <MScreen dir="A" bg={t.bg}>
      <div style={{
        height: `calc(100% - ${FA_NAV_H + FA_NAV_PAD}px)`,
        padding: '60px 24px 24px',
        display: 'flex', flexDirection: 'column', textAlign: 'center',
      }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          {/* Big star burst */}
          <div style={{ width: 110, height: 110, borderRadius: 999, background: t.primarySoft, display: 'grid', placeItems: 'center', marginBottom: 18, position: 'relative' }}>
            <div style={{ position: 'absolute', inset: -8, borderRadius: 999, border: `2px dashed ${t.primary}`, opacity: .35 }} />
            <svg width="56" height="56" viewBox="0 0 24 24" fill="#F2A900" stroke="#F2A900" strokeWidth="1.5" strokeLinejoin="round">
              <path d="M12 2l3 6.5 7 1-5 5 1.5 7-6.5-3.5L5.5 21 7 14 2 9l7-1L12 2z"/>
            </svg>
          </div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: t.text, letterSpacing: '-0.02em' }}>
            Thanks for your review!
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: t.textMute, lineHeight: 1.55, maxWidth: 280 }}>
            Your feedback helps families pick the right toys — and rewards owners who go above and beyond.
          </p>

          {/* Review preview */}
          <div style={{ marginTop: 24, width: '100%', padding: 14, background: t.surface, borderRadius: 16, border: `1px solid ${t.border}`, textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <img src={FAMILY_AVS.anna} style={{ width: 36, height: 36, borderRadius: 999, objectFit: 'cover' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>You reviewed Anna</div>
                <div style={{ fontSize: 11, color: t.textMute, marginTop: 1 }}>LEGO Duplo Town · just now</div>
              </div>
              <div style={{ display: 'flex', gap: 2 }}>
                {[0,1,2,3,4].map(i => (
                  <svg key={i} width="13" height="13" viewBox="0 0 24 24" fill="#F2A900"><path d="M12 2l3 6.5 7 1-5 5 1.5 7-6.5-3.5L5.5 21 7 14 2 9l7-1L12 2z"/></svg>
                ))}
              </div>
            </div>
            <div style={{ fontSize: 12, color: t.text, lineHeight: 1.55, padding: '10px 12px', background: t.bg, borderRadius: 10, borderLeft: `2px solid ${t.primary}` }}>
              "Anna was super communicative — pickup was easy and the set was spotless. My son loved it!"
            </div>
          </div>

          {/* Encourage browse */}
          <div style={{ marginTop: 20, padding: 14, background: t.surface, borderRadius: 14, border: `1px dashed ${t.border}`, display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: t.primarySoft, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <Icon name="heart" size={16} color={t.primary} />
            </div>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: t.text }}>Found a favorite owner?</div>
              <div style={{ fontSize: 11, color: t.textMute, marginTop: 1 }}>Follow Anna to see her new listings first.</div>
            </div>
            <button style={{ height: 32, padding: '0 12px', background: t.primary, color: '#fff', borderRadius: 999, border: 0, fontSize: 12, fontWeight: 700 }}>Follow</button>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          <button style={{ height: 48, background: t.primary, color: '#fff', borderRadius: 999, border: 0, fontSize: 14, fontWeight: 700 }}>
            Browse more toys
          </button>
          <button style={{ height: 44, background: 'transparent', color: t.text, borderRadius: 999, border: 0, fontSize: 13, fontWeight: 600 }}>
            Back to my rentals
          </button>
        </div>
      </div>
      <FANav active={3} />
    </MScreen>
  );
}

// =====================================================
// 4. PROFILE WITH RATING SUMMARY (public profile view)
// =====================================================
function FAOwnerPublicProfile() {
  const t = TOKENS.A;
  const breakdown = [
    { l: 'Communication',          v: 4.9, w: '98%' },
    { l: 'Toy condition',          v: 4.9, w: '98%' },
    { l: 'Cleanliness',            v: 4.8, w: '96%' },
    { l: 'Description accuracy',   v: 4.9, w: '98%' },
  ];
  return (
    <MScreen dir="A" bg={t.bg}>
      {/* Light dark header section */}
      <div style={{ background: t.surface, borderBottom: `1px solid ${t.border}` }}>
        <FATopBar back title="Profile" action={
          <button style={{ width: 40, height: 40, borderRadius: 999, background: 'transparent', display: 'grid', placeItems: 'center', border: 0 }}>
            <Icon name="arrow" size={17} color={t.text} />
          </button>
        } />
        {/* Identity card */}
        <div style={{ padding: '8px 16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <img src={FAMILY_AVS.anna} style={{ width: 72, height: 72, borderRadius: 999, objectFit: 'cover' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: t.text, letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 5 }}>
              Anna Sargsyan
              <Icon name="verified" size={16} color={t.success} />
            </div>
            <div style={{ fontSize: 11.5, color: t.textMute, marginTop: 2 }}>Yerevan · Member since 2024</div>
            {/* Trust badge */}
            <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, background: t.primarySoft, color: t.primary, fontSize: 11, fontWeight: 700 }}>
              <Icon name="shield" size={11} color={t.primary} /> Trusted owner
            </div>
          </div>
        </div>
      </div>

      <div style={{
        height: `calc(100% - ${FA_HEADER_H + 102}px)`,
        overflow: 'hidden', padding: '14px 16px 24px',
      }}>
        {/* Rating summary card */}
        <div style={{ padding: 18, background: t.surface, borderRadius: 16, border: `1px solid ${t.border}`, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div>
              <div style={{ fontSize: 36, fontWeight: 800, color: t.text, lineHeight: 1, letterSpacing: '-0.02em' }}>4.9</div>
              <div style={{ display: 'flex', gap: 2, marginTop: 4 }}>
                {[0,1,2,3,4].map(i => (
                  <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill="#F2A900"><path d="M12 2l3 6.5 7 1-5 5 1.5 7-6.5-3.5L5.5 21 7 14 2 9l7-1L12 2z"/></svg>
                ))}
              </div>
              <div style={{ fontSize: 11, color: t.textMute, marginTop: 4 }}>24 reviews</div>
            </div>
            <div style={{ flex: 1, display: 'grid', gap: 4 }}>
              {[
                { v: 5, c: 20 },
                { v: 4, c: 3 },
                { v: 3, c: 1 },
                { v: 2, c: 0 },
                { v: 1, c: 0 },
              ].map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10, color: t.textMute, width: 8 }}>{r.v}</span>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="#F2A900"><path d="M12 2l3 6.5 7 1-5 5 1.5 7-6.5-3.5L5.5 21 7 14 2 9l7-1L12 2z"/></svg>
                  <div style={{ flex: 1, height: 5, background: t.surfaceAlt, borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ width: `${(r.c / 24) * 100}%`, height: '100%', background: t.primary }} />
                  </div>
                  <span style={{ fontSize: 10, color: t.textMute, fontVariantNumeric: 'tabular-nums', width: 14, textAlign: 'right' }}>{r.c}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Subscores */}
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${t.border}`, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {breakdown.map((b, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11.5, color: t.text }}>{b.l}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: t.text }}>{b.v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Owner's listings strip */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: t.text }}>Anna's toys · 5</h3>
            <span style={{ fontSize: 12, fontWeight: 600, color: t.primary }}>See all</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FAListingCard img={TOY_IMGS.lego} title="LEGO Duplo Town" city="Kentron" price="₽1,500" age="2–5 yr" verified />
            <FAListingCard img={TOY_IMGS.kitchen} title="Wooden play kitchen" city="Kentron" price="₽1,200" age="3–7 yr" verified />
          </div>
        </div>

        {/* Recent review */}
        <div>
          <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: t.text }}>Recent review</h3>
          <ReviewItem
            name="Marina Hovhannisyan"
            av={FAMILY_AVS.marina}
            date="2 days ago"
            rating={5}
            text="Anna was super communicative — pickup was easy and the set was spotless. My son loved it!"
            toy="LEGO Duplo Town"
          />
        </div>
      </div>
    </MScreen>
  );
}

// Reusable single review row
function ReviewItem({ name, av, date, rating, text, toy }) {
  const t = TOKENS.A;
  return (
    <div style={{ padding: 14, background: t.surface, borderRadius: 14, border: `1px solid ${t.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <img src={av} style={{ width: 32, height: 32, borderRadius: 999, objectFit: 'cover' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: t.text }}>{name}</div>
          <div style={{ fontSize: 10.5, color: t.textMute }}>{date} · {toy}</div>
        </div>
        <div style={{ display: 'flex', gap: 1.5 }}>
          {Array.from({ length: 5 }, (_, i) => (
            <svg key={i} width="11" height="11" viewBox="0 0 24 24"
              fill={i < rating ? '#F2A900' : 'none'}
              stroke={i < rating ? '#F2A900' : t.border}
              strokeWidth="1.8" strokeLinejoin="round">
              <path d="M12 2l3 6.5 7 1-5 5 1.5 7-6.5-3.5L5.5 21 7 14 2 9l7-1L12 2z"/>
            </svg>
          ))}
        </div>
      </div>
      <p style={{ margin: 0, fontSize: 12.5, color: t.text, lineHeight: 1.55 }}>{text}</p>
    </div>
  );
}

// =====================================================
// 5. LISTING DETAIL — Reviews section (focused screen)
// =====================================================
function FAListingReviews() {
  const t = TOKENS.A;
  return (
    <MScreen dir="A" bg={t.bg}>
      <FATopBar back title="Reviews · LEGO Duplo Town" />
      <div style={{
        height: `calc(100% - ${FA_HEADER_H}px)`,
        overflow: 'hidden', padding: '16px 16px 24px',
      }}>
        {/* Aggregate */}
        <div style={{ padding: 16, background: t.surface, borderRadius: 16, border: `1px solid ${t.border}`, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 32, fontWeight: 800, color: t.text, lineHeight: 1, letterSpacing: '-0.02em' }}>4.9</div>
              <div style={{ display: 'flex', gap: 2, marginTop: 4 }}>
                {[0,1,2,3,4].map(i => (
                  <svg key={i} width="12" height="12" viewBox="0 0 24 24" fill="#F2A900"><path d="M12 2l3 6.5 7 1-5 5 1.5 7-6.5-3.5L5.5 21 7 14 2 9l7-1L12 2z"/></svg>
                ))}
              </div>
              <div style={{ fontSize: 11, color: t.textMute, marginTop: 4 }}>24 reviews · last 6 months</div>
            </div>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: t.primarySoft, display: 'grid', placeItems: 'center' }}>
              <Icon name="sparkle" size={28} color={t.primary} />
            </div>
          </div>
          {/* Top tags */}
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${t.border}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.textMute, letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 8 }}>Renters often mention</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['Spotless 🧼 21', 'All pieces ✅ 18', 'Easy pickup 🚶 15', 'Great owner 👋 12'].map((tg, i) => (
                <span key={i} style={{
                  padding: '6px 12px', borderRadius: 999, fontSize: 11.5, fontWeight: 600,
                  background: t.bg, color: t.text, border: `1px solid ${t.border}`,
                }}>{tg}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflow: 'hidden' }}>
          {['All 24', '5 ★ · 20', '4 ★ · 3', '3 ★ · 1'].map((f, i) => (
            <span key={i} style={{
              padding: '6px 12px', borderRadius: 999, fontSize: 11.5, fontWeight: 600,
              background: i === 0 ? t.text : t.surface,
              color: i === 0 ? '#fff' : t.text,
              border: i === 0 ? 'none' : `1px solid ${t.border}`,
              whiteSpace: 'nowrap',
            }}>{f}</span>
          ))}
        </div>

        {/* Review list */}
        <div style={{ display: 'grid', gap: 10 }}>
          <ReviewItem
            name="Marina Hovhannisyan"
            av={FAMILY_AVS.marina}
            date="2 days ago"
            rating={5}
            text="Super communicative — pickup was easy and the set was spotless. My son loved it!"
            toy="Rented 4 days"
          />
          <ReviewItem
            name="David Petrosyan"
            av={FAMILY_AVS.david}
            date="1 week ago"
            rating={5}
            text="All pieces accounted for, well sanitized. Anna was flexible with timing. Highly recommend."
            toy="Rented 5 days"
          />
          <ReviewItem
            name="Aram Karapetyan"
            av={FAMILY_AVS.aram}
            date="3 weeks ago"
            rating={4}
            text="Great toy, my daughter played non-stop. One mini-figure was a bit worn but no big deal."
            toy="Rented 7 days"
          />
        </div>

        <button style={{ marginTop: 14, width: '100%', height: 44, background: t.surface, color: t.text, borderRadius: 999, border: `1.5px solid ${t.border}`, fontSize: 13, fontWeight: 700 }}>
          Show all 24 reviews
        </button>
      </div>
    </MScreen>
  );
}

// =====================================================
// 6. POST-RENTAL PROMPT (notification screen prompting both reviews)
// =====================================================
function FARentalCompletePrompt() {
  const t = TOKENS.A;
  return (
    <MScreen dir="A" bg={t.bg}>
      <FATopBar back title="Rental complete" />
      <div style={{
        height: `calc(100% - ${FA_HEADER_H}px - ${FA_NAV_H + FA_NAV_PAD}px)`,
        overflow: 'hidden', padding: '20px 16px 24px',
      }}>
        {/* Hero */}
        <div style={{ padding: 18, background: t.surface, borderRadius: 16, border: `1px solid ${t.border}`, marginBottom: 16, textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: 22, background: t.primarySoft, display: 'grid', placeItems: 'center', margin: '0 auto 12px' }}>
            <Icon name="check" size={36} color={t.primary} strokeWidth={2.8} />
          </div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: t.text, letterSpacing: '-0.01em' }}>Rental complete!</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: t.textMute, lineHeight: 1.5 }}>
            How did it go? Leaving a review takes 30 seconds and helps the whole community.
          </p>
        </div>

        {/* Two CTAs — review owner + share toy */}
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ padding: 14, background: t.surface, borderRadius: 14, border: `1px solid ${t.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img src={FAMILY_AVS.anna} style={{ width: 44, height: 44, borderRadius: 999, objectFit: 'cover' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: t.text }}>Review Anna</div>
                <div style={{ fontSize: 11, color: t.textMute, marginTop: 1 }}>LEGO Duplo Town · 4 days</div>
              </div>
              <button style={{ height: 36, padding: '0 14px', background: t.primary, color: '#fff', borderRadius: 999, border: 0, fontSize: 12.5, fontWeight: 700 }}>
                Rate
              </button>
            </div>
          </div>

          <div style={{ padding: 14, background: t.surface, borderRadius: 14, border: `1px solid ${t.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: t.surfaceAlt, display: 'grid', placeItems: 'center' }}>
                <Icon name="heart" size={20} color={t.primary} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: t.text }}>Save Anna as favorite owner</div>
                <div style={{ fontSize: 11, color: t.textMute, marginTop: 1 }}>See her new toys first</div>
              </div>
              <button style={{ height: 36, padding: '0 14px', background: t.surface, color: t.text, borderRadius: 999, border: `1.5px solid ${t.border}`, fontSize: 12.5, fontWeight: 700 }}>
                Follow
              </button>
            </div>
          </div>

          <div style={{ padding: 14, background: t.bg, borderRadius: 14, border: `1px dashed ${t.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
            <Icon name="clock" size={18} color={t.textMute} />
            <div style={{ flex: 1, fontSize: 12, color: t.textMute, lineHeight: 1.5 }}>
              You have <strong style={{ color: t.text }}>14 days</strong> to leave a review. Both reviews go live once both sides have submitted.
            </div>
          </div>
        </div>
      </div>
      <FANav active={3} />
    </MScreen>
  );
}

Object.assign(window, {
  FARenterReview, FAOwnerReview, FAReviewSuccess,
  FAOwnerPublicProfile, FAListingReviews, FARentalCompletePrompt,
  StarRow, CriterionRow, ReviewItem,
});
