// Shared types for the post-event report.
//
// Kept in sync with the main CE app's lib/bootstrap-context.tsx — the report
// only needs the Sponsor shape (used for the sponsor/exhibitor strips), so
// it's copied here rather than dragging in the whole bootstrap context.
export type Sponsor = {
  spId: string
  company: string
  boothNo: string
  sponsorTier: string
  contactPoint: string
  profile: string
  websiteUrl: string
  logoUrl: string
  whatsapp: string
  boothCode?: string
  entriesAwarded?: number
}
