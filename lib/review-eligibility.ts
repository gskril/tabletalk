// Only the member-scoped Blackbird import writes visits. Demo/platform identities
// and visits from another provider environment must never authorize a review.
export const verifiedVisitFrom = `FROM visits v
  JOIN profiles member ON member.id=v.user_id
  JOIN venues place ON place.id=v.venue_id
  WHERE member.demo=0
    AND place.source IN ('staging','production')
    AND member.external_id LIKE place.source || ':%'`;
