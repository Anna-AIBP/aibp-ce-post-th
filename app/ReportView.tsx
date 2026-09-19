'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import type { Sponsor } from '@/lib/types'

const AIBP_LOGO =
  'https://images.squarespace-cdn.com/content/v1/6316ec4bc3127239ee7b0786/34cc06e3-f859-40f8-8c01-f758906ce1c9/AIBP+by+Industry+Platform+%28High+Res%29.png?format=300w'

// Endorsement/support/media-partner logo strip — pulled straight from the
// public event page (aibp.sg/conference-exhibition-thailand), same set as
// shown there. Static per-event branding, not sheet-driven.
// Only "Endorsed By: MDES" is confirmed from the public page as of this
// build — add "Supporting Partners" / "Supporting Media Partners" groups
// here once confirmed, same pattern as the ID build.
// Each logo can override the default height (h-12 sm:h-14) if needed for
// odd aspect ratios.
const HERO_ENDORSEMENTS: { label: string; logos: { name: string; url: string; h?: string }[] }[] = [
  {
    label: 'Endorsed By',
    logos: [
      { name: 'MDES', url: 'https://images.squarespace-cdn.com/content/6316ec4bc3127239ee7b0786/723d59de-e9a9-4f18-89ba-6e12d474a375/Logo+Original.png?content-type=image%2Fpng', h: 'h-12 sm:h-14' },
    ],
  },
]

type ReportMeta = {
  eventName: string
  day1: string
  day2: string
  venue: string
  themeTagline: string
  heroDescription: string
  heroPhotos: string[]
  day1SummaryUrl: string
  day2SummaryUrl: string
}
type StatBreakdown = { type: string; label: string; percentage: number }
type ReportStats = {
  totalAttendees: number
  totalCompanies: number
  pctStat3: number
  pctStat3Label: string
  breakdown: StatBreakdown[]
}
// Fully self-contained per session — no join against Agenda/Speakers, just
// whatever's typed straight into the report's own SESSIONS tab. A session
// has 1+ "presentations" — 1 for a plain standalone session, 2+ when rows
// share the same Session group key (e.g. two back-to-back mini-talks).
type SessionPresentation = {
  title: string
  description: string
  moderator: string
  panelists: string[]
  linkedinUrl: string
  videoUrl: string
  photos: string[]
  logos: string[]
  caseStudyUrl: string
  websiteUrl: string
}
type ReportSession = {
  id: string
  day: number
  order: number
  segmentLabel: string
  segmentIntro: string
  presentations: SessionPresentation[]
}
type AwardJudge = { name: string; title: string; company: string }
type AwardQuote = { quoteText: string; quoteAuthorName: string; quoteAuthorTitle: string }
type ReportAward = {
  category: string
  winnerCompany: string
  announcementText: string
  photos: string[]
  photoCaption: string
  judges: AwardJudge[]
  quotes: AwardQuote[]
}
// A "Category: Opening" row in the AWARDS sheet carries a shared intro
// paragraph (typed into the Announcement Text column) shown above the
// winners grid, instead of rendering as its own winner card.
type ReportAwards = { openingText: string; items: ReportAward[] }
type NetworkingParticipant = { title: string; company: string }
type ReportNetworkingSession = {
  id: string
  type: string
  title: string
  coHostedWith: string
  focusBullets: string[]
  photos: string[]
  articleUrl: string
  coHostLogo: string
  participants: NetworkingParticipant[]
}
type ReportTestimonial = { quoteText: string; name: string; title: string; company: string }
// Searchable past-participant directory entry — just Title/Company/Classification,
// no logo. "Classification" is a free-text sector label, same idea as the
// Stats breakdown categories (BFSI, Industrials, etc.) but not required to match.
type ParticipantEntry = { title: string; company: string; classification: string }

export type ReportData = {
  meta: ReportMeta
  stats: ReportStats
  sessions: ReportSession[]
  awards: ReportAwards
  networkingSessions: ReportNetworkingSession[]
  testimonials: ReportTestimonial[]
  participants: ParticipantEntry[]
  sponsors: Sponsor[]
  error?: string
}

const TIER_SECTION_LABELS: Record<string, string> = {
  PLATINUM: 'Platinum Sponsors',
  GOLD: 'Gold Sponsors',
  SILVER: 'Silver Sponsors',
  BRONZE: 'Bronze Sponsors',
  'WORKSHOP PARTNER': 'Workshop Partners',
  'AI SECURITY PARTNER': 'AI Security Partners',
  'PAVILION HOST': 'Pavilion Hosts',
  'SUPPORTING ORGANISATION': 'Supporting Organisations',
  EXHIBITOR: 'Exhibitors',
}
// Plural section label only when a tier actually has more than one sponsor
// (e.g. a single Platinum sponsor reads "Platinum Sponsor", not "Sponsors").
function tierSectionLabel(tier: string, count: number) {
  const label = TIER_SECTION_LABELS[tier] || tier
  return count === 1 ? label.replace(/s$/, '') : label
}
const TIER_ORDER = ['PLATINUM', 'GOLD', 'SILVER', 'BRONZE', 'WORKSHOP PARTNER', 'AI SECURITY PARTNER', 'PAVILION HOST', 'SUPPORTING ORGANISATION', 'EXHIBITOR']
// Per-tier title colour, matching the sponsor wall style used on the public site.
const TIER_COLORS: Record<string, string> = {
  PLATINUM: '#7C8798',
  GOLD: '#D4AF37',
  SILVER: '#9DA1A3',
  BRONZE: '#CD7F32',
  'WORKSHOP PARTNER': '#C17F3E',
  'AI SECURITY PARTNER': '#C17F3E',
  'PAVILION HOST': '#C17F3E',
  'SUPPORTING ORGANISATION': '#C17F3E',
}
const DEFAULT_TIER_COLOR = '#555555'

// Section body backgrounds cycle through these so consecutive sections never
// look identical underneath the gradient banners.
const BAND_CLASSES = ['bg-white', 'bg-gray-50']

function fmtDateRange(day1: string, day2: string) {
  if (!day1) return ''
  try {
    const d1 = new Date(day1 + 'T00:00:00')
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }
    if (!day2 || day2 === day1) return d1.toLocaleDateString('en-GB', opts)
    const d2 = new Date(day2 + 'T00:00:00')
    const sameMonth = d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear()
    if (sameMonth) {
      return `${d1.getDate()}–${d2.toLocaleDateString('en-GB', opts)}`
    }
    return `${d1.toLocaleDateString('en-GB', opts)} – ${d2.toLocaleDateString('en-GB', opts)}`
  } catch {
    return [day1, day2].filter(Boolean).join(' – ')
  }
}

// Turns a pasted video link (YouTube or Google Drive share link) into
// something embeddable in an iframe. Anything else falls back to a plain
// "open in new tab" link so a bad/unrecognised URL never breaks the page.
function getVideoEmbed(url: string): { type: 'youtube' | 'drive' | 'other'; embedUrl: string } | null {
  if (!url) return null
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/)
  if (yt) return { type: 'youtube', embedUrl: `https://www.youtube.com/embed/${yt[1]}?autoplay=1` }
  const drive = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/)
  if (drive) return { type: 'drive', embedUrl: `https://drive.google.com/file/d/${drive[1]}/preview` }
  return { type: 'other', embedUrl: url }
}

// Fades + slides each section up into place the first time it scrolls into
// view — no animation library needed.
function Reveal({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}
    >
      {children}
    </div>
  )
}

// "SESSION N: ..." group header shown once above whichever panel/presentation
// card(s) share that Session number — a solid red pill + a divider line so it
// reads clearly as a section header covering everything below it, rather than
// blending in as another line of small text.
function SegmentHeader({ label, intro }: { label: string; intro?: string }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-xs uppercase tracking-widest text-white font-extrabold bg-aibp-red px-3 py-1.5 rounded-full whitespace-nowrap flex-shrink-0">
          {label}
        </span>
        <span className="flex-1 h-px bg-aibp-red/25" />
      </div>
      {intro && (
        <div className="rounded-2xl bg-gradient-to-br from-aibp-gold/10 to-aibp-red/5 border border-aibp-gold/20 px-6 py-5">
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{intro}</p>
        </div>
      )}
    </div>
  )
}

// Thin bar at the very top tracking scroll progress through the whole report.
function ScrollProgressBar() {
  const [pct, setPct] = useState(0)
  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement
      const scrollTop = doc.scrollTop || document.body.scrollTop
      const scrollHeight = (doc.scrollHeight || document.body.scrollHeight) - doc.clientHeight
      setPct(scrollHeight > 0 ? Math.min(100, (scrollTop / scrollHeight) * 100) : 0)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <div className="fixed top-0 left-0 right-0 h-1 bg-gray-100 z-50">
      <div className="h-full bg-aibp-red transition-[width] duration-150 ease-out" style={{ width: `${pct}%` }} />
    </div>
  )
}

// Sticky pill nav that highlights whichever section is currently centred in
// the viewport.
function SectionNav({ items }: { items: { id: string; label: string }[] }) {
  const [active, setActive] = useState('')
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id)
        })
      },
      { rootMargin: '-40% 0px -55% 0px', threshold: 0 }
    )
    items.forEach((item) => {
      const el = document.getElementById(item.id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length])

  if (items.length === 0) return null
  return (
    <div className="sticky top-1 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-100">
      <div className="flex gap-1.5 overflow-x-auto px-4 sm:px-8 py-2.5 max-w-5xl mx-auto" style={{ scrollbarWidth: 'none' }}>
        {items.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
              active === item.id ? 'bg-aibp-red text-white' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {item.label}
          </a>
        ))}
      </div>
    </div>
  )
}

// The repeating gradient banner that opens every content page in the source
// PDF — logo chip on the left, date/venue on the right (hidden on small
// screens to keep the bar from wrapping), section title absolutely centred
// as a separate overlay layer rather than a 3-equal-column grid cell. A grid
// cell caps the title to a strict 1/3 of the banner width, which truncates
// a longer title (e.g. "Curated Meetings & Introductions" was clipping to
// "Curated Meetings & Intr…") purely because of how little room its own
// column gets, even though there's plenty of visually empty space around
// it. Overlaying the title lets it use most of the banner's width while
// staying mathematically centred, independent of the logo/date content on
// either side.
function SectionBanner({ title, subtitle, meta }: { title: string; subtitle?: string; meta: ReportMeta }) {
  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-[#241509] via-[#5C3319] to-[#834924]">
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{ backgroundImage: 'linear-gradient(115deg, transparent 46%, rgba(255,255,255,0.5) 50%, transparent 54%)' }}
      />
      <div className="relative z-10 max-w-5xl mx-auto px-5 sm:px-10 py-5 sm:py-7">
        <div className="flex items-center justify-between gap-4">
          <div className="bg-white rounded-lg px-2.5 py-1.5 flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={AIBP_LOGO} alt="AIBP" className="h-4 sm:h-5 object-contain" />
          </div>
          <div className="hidden sm:block text-right flex-shrink-0">
            <p className="text-white font-bold text-sm whitespace-nowrap">{fmtDateRange(meta.day1, meta.day2)}</p>
            <p className="text-white/70 text-xs whitespace-nowrap">{meta.venue}</p>
          </div>
        </div>
        {/* Centred overlay — sized off the row's own box (position:relative
            above), not the outer full-width gradient, so it lines up with
            the logo/date row above. Side padding keeps it clear of both. */}
        <div className="absolute inset-0 flex items-center justify-center px-16 sm:px-28 pointer-events-none">
          <div className="text-center min-w-0 max-w-full">
            <h2 className="text-white font-extrabold text-base sm:text-2xl leading-tight truncate">{title}</h2>
            {subtitle && <p className="text-white/70 text-[11px] sm:text-sm mt-0.5 truncate">{subtitle}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

function PhotoStrip({ photos }: { photos: string[] }) {
  if (photos.length === 0) return null
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
      {photos.map((url, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src={url}
          alt=""
          className="h-40 w-56 flex-shrink-0 rounded-xl object-cover snap-start bg-gray-100"
        />
      ))}
    </div>
  )
}

// Photo 1 shown big as a hero, any remaining photos as small thumbnails
// underneath. Clicking any of them opens a full-screen lightbox that can
// step through every photo in the set.
function PhotoGallery({ photos }: { photos: string[] }) {
  const [openAt, setOpenAt] = useState<number | null>(null)
  if (photos.length === 0) return null
  const [hero, ...rest] = photos

  return (
    <>
      <div className="flex flex-col gap-2">
        <button type="button" onClick={() => setOpenAt(0)} className="block w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={hero} alt="" className="w-full aspect-[4/3] object-cover rounded-lg bg-gray-100" />
        </button>
        {rest.length > 0 && (
          // Carousel strip — fixed, compact thumbnail height (so they stay
          // clearly smaller than the hero photo no matter how many there
          // are), with each tile sharing the row equally via flex-1 so the
          // whole strip always spans the same total width as the hero photo
          // above it (3 photos = 3 even tiles, 4 = 4, etc — never a gap).
          <div className="flex gap-2">
            {rest.map((url, i) => (
              <button type="button" key={i} onClick={() => setOpenAt(i + 1)} className="block flex-1 min-w-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-full h-20 sm:h-24 object-cover rounded-lg bg-gray-100" />
              </button>
            ))}
          </div>
        )}
      </div>
      {openAt !== null && (
        <PhotoLightbox photos={photos} index={openAt} onClose={() => setOpenAt(null)} onIndexChange={setOpenAt} />
      )}
    </>
  )
}

// Full-screen photo viewer with prev/next carousel navigation (click, arrow
// keys, or the dot indicators) — opened by PhotoGallery above.
function PhotoLightbox({
  photos,
  index,
  onClose,
  onIndexChange,
}: {
  photos: string[]
  index: number
  onClose: () => void
  onIndexChange: (i: number) => void
}) {
  const goPrev = () => onIndexChange((index - 1 + photos.length) % photos.length)
  const goNext = () => onIndexChange((index + 1) % photos.length)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') goPrev()
      if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-3 sm:p-6" onClick={onClose}>
      {/* Sized to intrinsic aspect ratio (w-auto h-auto) up to almost the full
          viewport, instead of being capped to a fixed max-width — that cap was
          leaving the photo looking small in a sea of black backdrop. */}
      <div
        className="relative flex items-center justify-center w-full flex-1 min-h-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photos[index]}
          alt=""
          className="w-auto h-auto max-w-full max-h-full object-contain rounded-lg"
        />
        {photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous photo"
              className="absolute left-1 sm:left-3 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full w-9 h-9 flex items-center justify-center text-xl"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Next photo"
              className="absolute right-1 sm:right-3 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full w-9 h-9 flex items-center justify-center text-xl"
            >
              ›
            </button>
          </>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-2 right-2 sm:-top-1 sm:-right-10 bg-black/50 sm:bg-transparent text-white text-2xl leading-none w-9 h-9 sm:w-auto sm:h-auto flex items-center justify-center rounded-full"
        >
          ×
        </button>
      </div>
      {photos.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-3 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {photos.map((_, i) => (
            <button
              type="button"
              key={i}
              onClick={() => onIndexChange(i)}
              aria-label={`Go to photo ${i + 1}`}
              className={`w-1.5 h-1.5 rounded-full ${i === index ? 'bg-white' : 'bg-white/30'}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

// "Watch Video" pill (matches the red pill button used on the PDF's session
// pages) that opens a lightbox with the embedded player. Handles YouTube and
// Google Drive links; anything else opens in a new tab instead.
function VideoButton({ url }: { url: string }) {
  const [open, setOpen] = useState(false)
  const embed = getVideoEmbed(url)
  if (!embed) return null

  if (embed.type === 'other') {
    return (
      <a
        href={embed.embedUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex w-full items-center justify-center gap-2 bg-aibp-red text-white text-[11px] font-bold uppercase tracking-wide px-4 py-2 rounded-full"
      >
        <PlayIcon /> Watch Video
      </a>
    )
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 bg-aibp-red text-white text-[11px] font-bold uppercase tracking-wide px-4 py-2 rounded-full"
      >
        <PlayIcon /> Watch Video
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div className="relative w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="w-full aspect-video bg-black rounded-xl overflow-hidden">
              <iframe
                src={embed.embedUrl}
                className="w-full h-full"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </div>
            <button
              onClick={() => setOpen(false)}
              className="absolute -top-9 right-0 text-white text-2xl leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function CaseStudyButton({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex w-full items-center justify-center gap-2 border border-aibp-red text-aibp-red text-[11px] font-bold uppercase tracking-wide px-4 py-2 rounded-full"
    >
      View Case Study →
    </a>
  )
}

function WebsiteButton({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex w-full items-center justify-center gap-2 border border-aibp-red text-aibp-red text-[11px] font-bold uppercase tracking-wide px-4 py-2 rounded-full"
    >
      Visit Website →
    </a>
  )
}

function IconPerson() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.6} className="w-6 h-6">
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" />
    </svg>
  )
}
function IconBuilding() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.6} className="w-6 h-6">
      <rect x="5" y="3" width="14" height="18" rx="1" />
      <path d="M9 7.5h.01M14 7.5h.01M9 11.5h.01M14 11.5h.01M9 15.5h.01M14 15.5h.01" strokeLinecap="round" />
    </svg>
  )
}
function IconFlag() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.6} className="w-6 h-6">
      <path d="M6 4v16" strokeLinecap="round" />
      <path d="M6 5h9l-2 3 2 3H6" strokeLinejoin="round" />
    </svg>
  )
}

function StatBadge({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="w-14 h-14 rounded-full bg-white/15 border border-white/30 flex items-center justify-center mb-3">
        {icon}
      </div>
      <p className="text-3xl sm:text-4xl font-extrabold text-white">{value}</p>
      <p className="text-[10px] sm:text-[11px] uppercase tracking-wide text-white/70 font-bold mt-1">{label}</p>
    </div>
  )
}

// Icon set cycled through for "icon row" breakdown groups (Seniority, etc.)
// — matches the PDF's hierarchy/checklist/specialist icon-per-tier style.
function IconHierarchy() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.6} className="w-6 h-6">
      <circle cx="12" cy="5" r="2" />
      <circle cx="6" cy="18" r="2" />
      <circle cx="12" cy="18" r="2" />
      <circle cx="18" cy="18" r="2" />
      <path d="M12 7v3M12 10H6v6M12 10h6v6" />
    </svg>
  )
}
function IconChecklist() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.6} className="w-6 h-6">
      <rect x="5" y="3" width="14" height="18" rx="1.5" />
      <path d="M8 8.3l1.2 1.2L11 7.5M8 14.3l1.2 1.2L11 13.5M13.2 8h3.3M13.2 14h3.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconPersonGear() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.6} className="w-6 h-6">
      <circle cx="9.5" cy="7" r="3" />
      <path d="M4 20c0-3.3 2.5-6 5.5-6" />
      <circle cx="18" cy="16" r="2.2" />
      <path d="M18 12.8v1M18 18.2v1M15.3 14.3l.9.5M20.7 17.2l.9.5M15.3 17.7l.9-.5M20.7 14.8l.9-.5" strokeLinecap="round" />
    </svg>
  )
}
const ICON_ROW_ICONS = [IconHierarchy, IconChecklist, IconPersonGear]

// Icon + big percentage + label, stacked — the left-hand "By Seniority"
// style in the source PDF's stats page.
function IconStatRow({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="flex items-center justify-center gap-4">
      <div className="w-12 h-12 rounded-full border-2 border-white/40 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="text-left">
        <p className="text-2xl sm:text-3xl font-extrabold text-white leading-none">{value}%</p>
        <p className="text-xs text-white/70 mt-1">{label}</p>
      </div>
    </div>
  )
}

// Horizontal bar chart with a shared 0%-to-max axis — the right-hand
// "Industry" style in the source PDF's stats page. Works for any breakdown
// group, so it's reused for Industry, Function, IT Function, etc.
function BarChartGroup({ rows }: { rows: StatBreakdown[] }) {
  const axisMax = Math.max(10, Math.ceil(Math.max(...rows.map((r) => r.percentage)) / 10) * 10)
  const tickCount = axisMax / 10
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => i * 10)

  return (
    <div>
      <div className="grid grid-cols-[7rem_1fr] gap-y-2.5 gap-x-3 items-center mb-2">
        {rows.map((r) => (
          <Fragment key={r.label}>
            <span className="text-xs text-white/80 text-right italic truncate">{r.label}</span>
            <div className="relative h-5 bg-white/10 rounded-sm">
              <div
                className="absolute inset-y-0 left-0 bg-white rounded-sm flex items-center justify-end px-1.5"
                style={{ width: `${Math.max(8, (r.percentage / axisMax) * 100)}%` }}
              >
                <span className="text-[10px] font-bold text-gray-900 whitespace-nowrap">{r.percentage}%</span>
              </div>
            </div>
          </Fragment>
        ))}
      </div>
      <div className="grid grid-cols-[7rem_1fr] gap-x-3">
        <span />
        <div className="flex justify-between text-[10px] text-white/50 pt-1 border-t border-white/10">
          {ticks.map((t) => <span key={t}>{t}%</span>)}
        </div>
      </div>
    </div>
  )
}

// Sector icon for the Participant Directory — matched by keyword against the
// free-text "Classification" column, same idea as the Stats breakdown
// categories (BFSI, Industrials, etc.) but forgiving of any wording.
const PARTICIPANT_SECTOR_STYLES: Record<string, { bg: string; stroke: string }> = {
  bfsi: { bg: '#e8f0fd', stroke: '#0046BE' },
  dtlf: { bg: '#fef3e2', stroke: '#d97706' },
  industrials: { bg: '#ecfdf5', stroke: '#059669' },
  public: { bg: '#f0f4ff', stroke: '#4f46e5' },
  realestate: { bg: '#fdf2f8', stroke: '#db2777' },
  telecom: { bg: '#f0fdf4', stroke: '#16a34a' },
  default: { bg: '#f1f5f9', stroke: '#64748b' },
}
function getParticipantSectorKey(classification: string) {
  const x = (classification || '').toLowerCase()
  if (x.includes('bfsi')) return 'bfsi'
  if (x.includes('dtlf') || x.includes('transport') || x.includes('logist')) return 'dtlf'
  if (x.includes('industrial')) return 'industrials'
  if (x.includes('public') || x.includes('government')) return 'public'
  if (x.includes('real') || x.includes('hospit')) return 'realestate'
  if (x.includes('telec')) return 'telecom'
  return 'default'
}
function ParticipantSectorIcon({ classification }: { classification: string }) {
  const key = getParticipantSectorKey(classification)
  const { bg, stroke } = PARTICIPANT_SECTOR_STYLES[key]
  const common = { fill: 'none', stroke, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  let path: React.ReactNode
  switch (key) {
    case 'bfsi':
      path = <><path d="M12 2L2 7h20L12 2z" /><rect x="3" y="11" width="3" height="8" /><rect x="10.5" y="11" width="3" height="8" /><rect x="18" y="11" width="3" height="8" /><path d="M2 19h20" /></>
      break
    case 'dtlf':
      path = <><rect x="1" y="13" width="14" height="8" rx="1" /><path d="M15 13l4-4h4v8h-8" /><circle cx="5" cy="21" r="2" /><circle cx="18" cy="21" r="2" /></>
      break
    case 'industrials':
      path = <path d="M2 20h20M4 20V10l4-4v14M12 20V6l4-6v20M20 20v-8l-4 4" />
      break
    case 'public':
      path = <path d="M3 21h18M3 7l9-4 9 4M4 7v14M20 7v14M9 21v-6h6v6" />
      break
    case 'realestate':
      path = <><path d="M3 21h18M9 21V9l3-3 3 3v12" /><path d="M3 9l9-7 9 7" /></>
      break
    case 'telecom':
      path = <path d="M22 16.9v3a2 2 0 01-2.18 2 19.8 19.8 0 01-8.63-3.07A19.5 19.5 0 015.1 12.72 19.8 19.8 0 012.12 4.1 2 2 0 014.11 2h3a2 2 0 012 1.72c.13 1 .36 1.97.71 2.9a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.93.35 1.9.58 2.9.71A2 2 0 0122 16.9z" />
      break
    default:
      path = <><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></>
  }
  return (
    <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
      <svg viewBox="0 0 24 24" className="w-5 h-5" {...common}>{path}</svg>
    </div>
  )
}

// Searchable past-participant directory — company + job-title filters over
// data already fetched in the main /api/report payload (no separate sheet
// fetch needed, unlike the standalone version this was adapted from).
function ParticipantsDirectory({ participants }: { participants: ParticipantEntry[] }) {
  const [companyQuery, setCompanyQuery] = useState('')
  const [titleQuery, setTitleQuery] = useState('')

  const hasQuery = companyQuery.trim() !== '' || titleQuery.trim() !== ''
  const filtered = hasQuery
    ? participants.filter((p) => {
        const c = companyQuery.trim().toLowerCase()
        const t = titleQuery.trim().toLowerCase()
        return p.company.toLowerCase().includes(c) && p.title.toLowerCase().includes(t)
      })
    : []

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <label className="block text-[11px] uppercase tracking-wide text-gray-400 font-bold mb-2">Company</label>
          <input
            type="text"
            value={companyQuery}
            onChange={(e) => setCompanyQuery(e.target.value)}
            placeholder="e.g. Maybank"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-aibp-red bg-gray-50 focus:bg-white"
          />
        </div>
        <div className="flex-1">
          <label className="block text-[11px] uppercase tracking-wide text-gray-400 font-bold mb-2">Job Title</label>
          <input
            type="text"
            value={titleQuery}
            onChange={(e) => setTitleQuery(e.target.value)}
            placeholder="e.g. Head of IT"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-aibp-red bg-gray-50 focus:bg-white"
          />
        </div>
      </div>

      <div className="flex items-center justify-end mb-4 min-h-[20px]">
        {hasQuery && (
          <button
            onClick={() => { setCompanyQuery(''); setTitleQuery('') }}
            className="text-xs font-bold text-aibp-red"
          >
            ✕ Clear search
          </button>
        )}
      </div>

      {!hasQuery ? (
        <div className="py-16 text-center">
          <p className="text-3xl mb-4">🔍</p>
          <h3 className="text-sm font-bold text-gray-900 mb-2">Search the Participant Directory</h3>
          <p className="text-xs text-gray-400 leading-relaxed">Start typing a company name or job title above<br />to find participants.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-3xl mb-4">😕</p>
          <p className="text-xs text-gray-400 leading-relaxed">No participants match your search.<br /><span className="font-bold">Try different keywords.</span></p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {filtered.map((p, i) => (
            <div key={i} className="border border-gray-100 rounded-xl p-5 flex flex-col items-center text-center bg-white h-full">
              <ParticipantSectorIcon classification={p.classification} />
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-aibp-red mt-3 mb-1.5">{p.company}</p>
              <p className="text-sm font-bold text-gray-900 leading-snug mb-2">{p.title}</p>
              {p.classification && (
                <span className="text-[10px] font-bold text-gray-400 bg-gray-50 border border-gray-100 rounded-full px-3 py-1 mt-auto">{p.classification}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ReportView({ data }: { data: ReportData }) {
  if (!data || data.error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4 text-center">
        <p className="text-sm text-gray-400">Report isn&rsquo;t available right now — try again shortly.</p>
      </div>
    )
  }

  const { meta, stats, sessions, awards, networkingSessions, testimonials, participants, sponsors } = data
  const sessionsByDay = sessions.reduce<Record<number, ReportSession[]>>((acc, s) => {
    (acc[s.day] = acc[s.day] || []).push(s)
    return acc
  }, {})
  const days = Object.keys(sessionsByDay).map(Number).sort((a, b) => a - b)

  // Alternation index for PANEL cards only (blank-"Presentation" standalone
  // sessions), computed once across the whole event in render order — so a
  // presentation-slot card sitting between two panels doesn't throw off which
  // side each panel's photo column lands on.
  const panelAlternationIndex: Record<string, number> = {}
  {
    let i = 0
    sessions
      .slice()
      .sort((a, b) => a.day - b.day || a.order - b.order)
      .forEach((s) => {
        if (s.id.startsWith('row-')) panelAlternationIndex[s.id] = i++
      })
  }

  const sponsorsByTier = sponsors.reduce<Record<string, Sponsor[]>>((acc, s) => {
    const tier = (s.sponsorTier || 'EXHIBITOR').toUpperCase();
    (acc[tier] = acc[tier] || []).push(s)
    return acc
  }, {})

  // Groups breakdown rows by whatever "Type" was typed into the sheet — no
  // fixed list, so adding a new breakdown dimension (e.g. "Function") later
  // never needs a code change, it just shows up as its own group here.
  const breakdownGroups = Object.values(
    stats.breakdown.reduce<Record<string, { label: string; rows: StatBreakdown[] }>>((acc, b) => {
      const key = b.type.trim().toLowerCase()
      if (!acc[key]) acc[key] = { label: b.type.trim(), rows: [] }
      acc[key].rows.push(b)
      return acc
    }, {})
  ).filter((g) => g.rows.length > 0)
  // "Seniority" always renders as icon rows (matches the PDF); every other
  // group (Industry, Function, IT Function, ...) renders as a bar chart.
  // Seniority is pulled to the front so it pairs with whatever comes next.
  breakdownGroups.sort((a, b) => {
    const aSen = a.label.toLowerCase() === 'seniority' ? 0 : 1
    const bSen = b.label.toLowerCase() === 'seniority' ? 0 : 1
    return aSen - bSen
  })
  const breakdownRows: (typeof breakdownGroups)[number][][] = []
  for (let i = 0; i < breakdownGroups.length; i += 2) {
    breakdownRows.push(breakdownGroups.slice(i, i + 2))
  }

  const hasAnyContent =
    meta.themeTagline || meta.heroDescription || stats.totalAttendees > 0 ||
    sessions.some((s) => s.presentations.some((p) => p.description || p.photos.length)) ||
    awards.items.length > 0 || networkingSessions.length > 0 || testimonials.length > 0

  let bandIndex = 0
  // Fixed order per Aizat's spec: Overview, Awards, Day 1, Day 2, Networking,
  // Participants (placeholder), Feedback, Sponsors. Awards, Networking, and
  // Participants are reserved nav slots that always show (with a "coming
  // soon" placeholder when empty) since they're being filled in over time;
  // Overview/Days/Feedback/Sponsors still only show once there's real data.
  const navItems: { id: string; label: string }[] = []
  if (stats.totalAttendees > 0) navItems.push({ id: 'numbers', label: 'Overview' })
  navItems.push({ id: 'awards', label: 'Awards' })
  days.forEach((d) => navItems.push({ id: `day-${d}`, label: `Day ${d}` }))
  navItems.push({ id: 'networking', label: 'Networking' })
  navItems.push({ id: 'participants', label: 'Participants' })
  if (testimonials.length > 0) navItems.push({ id: 'feedback', label: 'Feedback' })
  if (sponsors.length > 0) navItems.push({ id: 'sponsors', label: 'Sponsors' })

  return (
    <div className="min-h-screen bg-white pb-16">
      <ScrollProgressBar />

      {/* Cover — dark diagonal wedge + gradient, echoing the PDF's cover page */}
      <header className="relative overflow-hidden bg-gradient-to-br from-[#3D2410] via-[#7A4A26] to-[#A85F30] text-white safe-top">
        {/* diagonal dark wedge, bottom-left, like the cover's cityscape overlay */}
        <div
          className="absolute inset-0 bg-[#1C2340]/70 pointer-events-none"
          style={{ clipPath: 'polygon(0 0, 42% 0, 16% 100%, 0% 100%)' }}
        />
        {/* faint gold skyline silhouette along the bottom */}
        <svg className="absolute bottom-0 left-0 w-full h-16 sm:h-24 text-white/10" viewBox="0 0 400 60" preserveAspectRatio="none" fill="currentColor">
          <rect x="0" y="20" width="18" height="40" />
          <rect x="22" y="10" width="14" height="50" />
          <rect x="40" y="28" width="20" height="32" />
          <rect x="64" y="0" width="12" height="60" />
          <rect x="80" y="18" width="16" height="42" />
          <rect x="340" y="22" width="18" height="38" />
          <rect x="362" y="8" width="14" height="52" />
          <rect x="380" y="24" width="20" height="36" />
        </svg>

        <div className="relative z-10 max-w-5xl mx-auto px-5 sm:px-12 pt-10 sm:pt-14 pb-14 sm:pb-20">
          <div className="flex items-center justify-between mb-10 sm:mb-16">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={AIBP_LOGO} alt="AIBP" className="h-7 sm:h-9 object-contain brightness-0 invert" />
            <span className="text-[10px] sm:text-xs uppercase tracking-widest bg-white/15 border border-white/30 rounded-full px-3 py-1 font-bold">
              Post-Conference Report
            </span>
          </div>

          {meta.themeTagline && (
            <p className="text-sm sm:text-base text-white/70 italic mb-3 max-w-xl">{meta.themeTagline}</p>
          )}
          <h1 className="text-3xl sm:text-5xl font-extrabold leading-tight mb-4 max-w-2xl tracking-tight">
            {meta.eventName || '55th AIBP Conference & Exhibition Thailand'}
          </h1>
          <p className="text-sm sm:text-base text-white/80 font-semibold">
            {[fmtDateRange(meta.day1, meta.day2), meta.venue].filter(Boolean).join(' · ')}
          </p>
          {meta.heroDescription && (
            <p className="text-sm sm:text-base text-white/70 leading-relaxed mt-6 max-w-xl">{meta.heroDescription}</p>
          )}
          {(meta.day1SummaryUrl || meta.day2SummaryUrl) && (
            <div className="flex flex-wrap gap-3 mt-8">
              {meta.day1SummaryUrl && (
                <a
                  href={meta.day1SummaryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold uppercase tracking-wide bg-white/15 hover:bg-white/25 border border-white/30 rounded-full px-5 py-2.5 transition-colors"
                >
                  Day 1 Summary Article →
                </a>
              )}
              {meta.day2SummaryUrl && (
                <a
                  href={meta.day2SummaryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold uppercase tracking-wide bg-white/15 hover:bg-white/25 border border-white/30 rounded-full px-5 py-2.5 transition-colors"
                >
                  Day 2 Summary Article →
                </a>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Endorsed By / Supporting Partners / Supporting Media Partners — white
          card floating just below the blue gradient hero, same layout as the
          public event page. */}
      {HERO_ENDORSEMENTS.length > 0 && (
        <div className="relative z-10 max-w-4xl mx-auto px-5 sm:px-10 -mt-8 sm:-mt-10">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 px-6 sm:px-10 py-6 sm:py-8">
            <div className="flex flex-wrap justify-center sm:justify-between gap-x-10 gap-y-6 text-center sm:text-left">
              {HERO_ENDORSEMENTS.map((group) => (
                <div key={group.label}>
                  <p className="text-[10px] sm:text-xs uppercase tracking-widest text-gray-400 font-bold mb-3">{group.label}</p>
                  <div className="flex flex-wrap justify-center sm:justify-start items-center gap-4 sm:gap-5">
                    {group.logos.map((logo) => (
                      // Fixed-size box per logo (not just a fixed height) so a
                      // squarish badge/seal doesn't render bigger or smaller
                      // than a wide wordmark just because of its own aspect
                      // ratio or built-in padding — same treatment as the
                      // Featuring/Sponsors logo rows below.
                      <div key={logo.name} className={`${logo.h ?? 'h-12 sm:h-14'} w-[130px] sm:w-[150px] flex items-center justify-center`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={logo.url} alt={logo.name} className="max-h-full max-w-full object-contain" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {meta.heroPhotos.length > 0 && (
        <div className="py-5 px-5 sm:px-10 border-b border-gray-100 bg-white max-w-5xl mx-auto">
          <PhotoStrip photos={meta.heroPhotos} />
        </div>
      )}

      <SectionNav items={navItems} />

      {!hasAnyContent && (
        <div className="px-5 py-16 text-center">
          <p className="text-sm text-gray-400">
            Report content is still being put together — check back soon.
          </p>
        </div>
      )}

      {/* Stats — full-bleed dark photo backdrop with icon-badge numbers, like the PDF's participant overview page */}
      {stats.totalAttendees > 0 && (
        <section id="numbers" className="border-b border-gray-100">
          <SectionBanner title="Participants Overview" subtitle="By the numbers" meta={meta} />
          <Reveal>
            <div className="relative overflow-hidden bg-gray-900">
              {meta.heroPhotos[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={meta.heroPhotos[0]} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
              )}
              <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/60 to-black/80 pointer-events-none" />
              <div className="relative z-10 max-w-5xl mx-auto px-5 sm:px-10 py-12 sm:py-16">
                <div className="grid grid-cols-3 gap-4 sm:gap-8 mb-10 sm:mb-14">
                  <StatBadge icon={<IconPerson />} value={String(stats.totalAttendees)} label="Attendees" />
                  <StatBadge icon={<IconBuilding />} value={String(stats.totalCompanies)} label="Companies" />
                  <StatBadge icon={<IconFlag />} value={`${stats.pctStat3}%`} label={stats.pctStat3Label} />
                </div>

                <div className="flex flex-col gap-10">
                  {breakdownRows.map((pair, pairIdx) => (
                    <div key={pairIdx} className="grid sm:grid-cols-3 gap-8">
                      {pair.map((g, gIdx) => {
                        const isSeniority = g.label.toLowerCase() === 'seniority'
                        // 3-col template mirrors the stat badges above it:
                        // first group sits under Attendees (1/3), second
                        // spans under Companies + Local Enterprises (2/3) —
                        // when a row only has one group, let it take the
                        // full width instead of hugging the left edge.
                        const spanClass =
                          pair.length === 1 ? 'sm:col-span-3' : gIdx === 0 ? 'sm:col-span-1' : 'sm:col-span-2'
                        return (
                          <div key={g.label} className={spanClass}>
                            <p className="text-[11px] uppercase tracking-wide text-white/60 font-bold mb-4">By {g.label}</p>
                            {isSeniority ? (
                              <div className="flex flex-col gap-5">
                                {g.rows.map((r, i) => {
                                  const Icon = ICON_ROW_ICONS[i % ICON_ROW_ICONS.length]
                                  return <IconStatRow key={r.label} icon={<Icon />} value={r.percentage} label={r.label} />
                                })}
                              </div>
                            ) : (
                              <BarChartGroup rows={g.rows} />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </section>
      )}

      {/* Awards — winner banner + photo pair + judges list, like the PDF's award-winner spreads.
          Always rendered (nav slot always shown) — falls back to a "coming soon" placeholder
          when the AWARDS tab hasn't been filled in yet. */}
      <section id="awards" className="border-b border-gray-100">
        <SectionBanner title="Award Winners" subtitle="Recognition" meta={meta} />
        {awards.items.length === 0 ? (
          <div className={`px-5 py-16 text-center ${BAND_CLASSES[bandIndex++ % BAND_CLASSES.length]}`}>
            <p className="text-sm text-gray-400">Award winners are still being finalised — check back soon.</p>
          </div>
        ) : (
          <div className={`px-5 sm:px-10 py-10 sm:py-14 ${BAND_CLASSES[bandIndex++ % BAND_CLASSES.length]}`}>
            <div className="max-w-5xl mx-auto flex flex-col gap-8">
              {/* Shared intro paragraph — typed into the "Opening" row's Announcement
                  Text column in the sheet, shown above the winners grid. */}
              {awards.openingText && (
                <Reveal>
                  <div className="rounded-2xl bg-gradient-to-br from-aibp-gold/10 to-aibp-red/5 border border-aibp-gold/20 px-6 py-5">
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{awards.openingText}</p>
                  </div>
                </Reveal>
              )}

              {/* Winners side by side on tablet/desktop (fixed 2 columns, wrapping
                  beyond that); single column on mobile so cards don't get squeezed. */}
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                {awards.items.map((a) => (
                  <Reveal key={a.category}>
                    <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm bg-white h-full flex flex-col">
                      <div className="bg-gradient-to-r from-[#241509] to-[#834924] px-5 py-4">
                        <p className="text-white/70 text-[10px] uppercase tracking-wide font-bold mb-0.5">{a.category}</p>
                        <h3 className="text-white text-xl font-extrabold">{a.winnerCompany}</h3>
                      </div>
                      <div className="p-5 flex flex-col gap-3">
                        {a.announcementText && <p className="text-sm text-gray-600 leading-relaxed">{a.announcementText}</p>}
                        {a.photos.length > 0 && <PhotoGallery photos={a.photos} />}
                        {a.photoCaption && <p className="text-[11px] text-gray-400 italic">{a.photoCaption}</p>}
                        {a.judges.length > 0 && (
                          <div className="border-t border-gray-100 pt-3 mt-1">
                            <p className="text-[10px] uppercase tracking-wide text-gray-400 font-bold mb-2">Judges</p>
                            <ul className="flex flex-col gap-2">
                              {a.judges.map((j, i) => (
                                <li key={i} className="text-xs text-gray-600 leading-snug border-b border-gray-50 pb-2 last:border-0">
                                  <span className="font-bold text-gray-800 block">{j.name}</span>
                                  {[j.title, j.company].filter(Boolean).join(', ')}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>

              {/* Quotes — pulled out of the winner cards and shown as their own
                  separated block below, one column per winner that has a quote. */}
              {awards.items.some((a) => a.quotes.length > 0) && (
                <div className="grid grid-cols-1 gap-6 pt-8 border-t border-gray-100 sm:grid-cols-2">
                  {awards.items.map((a) => (
                    a.quotes.length > 0 && (
                      <Reveal key={a.category}>
                        <div className="flex flex-col gap-5">
                          {a.quotes.map((q, i) => (
                            <blockquote key={i} className="text-sm text-gray-700 italic leading-relaxed">
                              <p className="text-3xl text-aibp-red/30 leading-none mb-1">&ldquo;</p>
                              {q.quoteText}
                              {q.quoteAuthorName && (
                                <footer className="text-xs text-gray-400 mt-2 not-italic font-bold">
                                  — {q.quoteAuthorName}{q.quoteAuthorTitle ? `, ${q.quoteAuthorTitle}` : ''}
                                </footer>
                              )}
                            </blockquote>
                          ))}
                        </div>
                      </Reveal>
                    )
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Sessions by day — one banner per day, each session a 3-part panel:
          title/description, moderator+panelists, photos+video — mirroring
          the PDF's per-session page layout instead of a single repeating
          card. Everything here comes straight from one flat sheet row. */}
      {days.map((day) => (
        <section key={day} id={`day-${day}`} className="border-b border-gray-100">
          <SectionBanner title={`Day ${day} Sessions`} subtitle={meta.eventName} meta={meta} />
          <div className={`px-5 sm:px-10 py-10 sm:py-14 ${BAND_CLASSES[bandIndex++ % BAND_CLASSES.length]}`}>
            <div className="max-w-5xl mx-auto flex flex-col gap-6">
              {sessionsByDay[day]
                .sort((a, b) => a.order - b.order)
                .map((s) => {
                  // Rows with a blank "Presentation" column are always their own
                  // standalone PANEL card (id "row-N") — these keep the original
                  // wide 3-column desc/speaker/photo layout, unchanged.
                  // Rows that DO have a Session + Presentation number (id
                  // "day{n}-{key}") are individual presentation slots — these use
                  // the compact single-box style below, whether there's just one
                  // presentation in that slot or several merged together, so a
                  // lone presentation with no description doesn't waste a whole
                  // empty column the way the old 3-column layout did.
                  const isPanel = s.id.startsWith('row-')

                  if (isPanel) {
                    const p = s.presentations[0]
                    const descCol = (
                      <div key="desc" className="p-5 sm:flex-1 min-w-0">
                        {p.description ? (
                          <p className="text-xs italic text-gray-500 leading-relaxed">{p.description}</p>
                        ) : (
                          <p className="text-xs text-gray-300">—</p>
                        )}
                      </div>
                    )
                    const speakerCol = (
                      <div key="speaker" className="p-5 sm:flex-1 min-w-0">
                        {p.moderator && (
                          <div className="mb-3">
                            <p className="text-[10px] uppercase tracking-wide text-gray-400 font-bold mb-1">Moderator</p>
                            <p className="text-xs text-gray-700 leading-snug">{p.moderator}</p>
                          </div>
                        )}
                        {p.panelists.length > 0 && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-gray-400 font-bold mb-1">Panelists</p>
                            <ul className="flex flex-col gap-1.5">
                              {p.panelists.map((name, i) => (
                                <li key={i} className="text-xs text-gray-700 leading-snug">{name}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {!p.moderator && p.panelists.length === 0 && (
                          <p className="text-xs text-gray-300">—</p>
                        )}
                        {p.linkedinUrl && (
                          <a href={p.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-aibp-red mt-3 inline-block">
                            Join the Conversation on LinkedIn →
                          </a>
                        )}
                      </div>
                    )
                    // Slightly wider than the other two columns (flex-[1.25] vs
                    // flex-1) so photos read a bit bigger, regardless of which
                    // side they land on.
                    const photosCol = (
                      <div key="photos" className="p-5 sm:flex-[1.25] min-w-0">
                        {p.photos.length > 0 ? (
                          <PhotoGallery photos={p.photos} />
                        ) : (
                          <p className="text-[11px] text-gray-300">No photos yet</p>
                        )}
                        {(p.videoUrl || p.caseStudyUrl || p.websiteUrl) && (
                          <div className="flex flex-col gap-3 mt-3">
                            {p.videoUrl && <VideoButton url={p.videoUrl} />}
                            {p.caseStudyUrl ? (
                              <CaseStudyButton url={p.caseStudyUrl} />
                            ) : (
                              p.websiteUrl && <WebsiteButton url={p.websiteUrl} />
                            )}
                          </div>
                        )}
                      </div>
                    )
                    // Description + speaker columns are grouped into one block so
                    // the logo row can span underneath both of them in a single
                    // line, rather than being squeezed into just the speaker
                    // column's width — while still leaving the photos column on
                    // its own, on whichever side the alternation puts it.
                    const descSpeakerBlock = (
                      <div key="descSpeaker" className="sm:flex-[2] min-w-0 flex flex-col">
                        <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-gray-100 flex-1">
                          {descCol}
                          {speakerCol}
                        </div>
                        {p.logos.length > 0 && (
                          <div className="p-5 border-t border-gray-100">
                            <p className="text-[10px] uppercase tracking-wide text-gray-400 font-bold mb-3">Featuring</p>
                            {/* Fixed-size box per logo (not just a fixed height) so a
                                squarish badge/seal (lots of built-in padding) scales up
                                to fill the box the same way a wide wordmark does,
                                instead of reading much smaller at the same height. */}
                            <div className="flex flex-wrap items-center gap-5">
                              {p.logos.map((url, i) => (
                                <div key={i} className="h-14 sm:h-16 w-[110px] sm:w-[130px] flex items-center justify-center">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={url} alt="" className="max-h-full max-w-full object-contain" />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )

                    // Alternate which side the description/photos sit on so
                    // consecutive PANELS don't all look identical — title always
                    // stays on top regardless. Uses a panel-only running index
                    // (computed above) so an interleaved presentation-slot card
                    // never throws off the left/right alternation between panels.
                    const alt = panelAlternationIndex[s.id] ?? 0
                    const columns = alt % 2 === 1 ? [photosCol, descSpeakerBlock] : [descSpeakerBlock, photosCol]

                    return (
                      <Reveal key={s.id}>
                        {s.segmentLabel && <SegmentHeader label={s.segmentLabel} intro={s.segmentIntro} />}
                        <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm bg-white">
                          <div className="bg-gradient-to-br from-[#F1F3F9] to-white p-5">
                            <h3 className="text-lg font-bold text-gray-900 leading-snug">{p.title}</h3>
                          </div>
                          <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-gray-100 border-t border-gray-100">
                            {columns}
                          </div>
                        </div>
                      </Reveal>
                    )
                  }

                  // Presentation slot(s) — one or more presentations grouped under
                  // a Session + Presentation number. Compact box-per-presentation
                  // style, so a lone presentation with no description doesn't get
                  // a wide, half-empty card.
                  const sharedLinkedin = s.presentations.map((p) => p.linkedinUrl).find(Boolean)
                  return (
                    <Reveal key={s.id}>
                      {s.segmentLabel && <SegmentHeader label={s.segmentLabel} intro={s.segmentIntro} />}
                      <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm bg-white">
                        <div className="bg-gradient-to-br from-[#F1F3F9] to-white p-5">
                          <h3 className="text-lg font-bold text-gray-900 leading-snug">Presentations</h3>
                        </div>
                        {/* Cards are a fixed size (a third of the row, like a
                            3-column grid) so a single presentation never
                            stretches to fill the whole width — but the row
                            itself doesn't force 3 equal grid tracks, so 1 or 2
                            presentations just sit left-aligned at their normal
                            size instead of leaving a blank "missing" box next
                            to them. 4+ wraps to a new line. Single column, full
                            width on mobile. */}
                        <div className="flex flex-wrap gap-4 p-5 border-t border-gray-100">
                          {s.presentations.map((p, i) => (
                            <div key={i} className="border border-gray-100 rounded-xl p-4 flex flex-col w-full sm:w-auto sm:flex-none sm:basis-[calc((100%-2rem)/3)]">
                              <div>
                                {/* Each card carries its own title — the header above
                                    is just the generic "Presentations" label for the
                                    group. */}
                                {/* Reserves space for 2 lines even when the title only
                                    needs 1, so a longer neighbouring title wrapping to a
                                    second line doesn't push its photo/buttons down relative
                                    to the others in the same row. */}
                                <h4 className="text-sm font-bold text-gray-900 leading-snug mb-3 min-h-[2.75rem]">{p.title}</h4>
                                {p.moderator && (
                                  <div className="mb-2">
                                    <p className="text-[10px] uppercase tracking-wide text-gray-400 font-bold mb-0.5">Moderator</p>
                                    <p className="text-xs text-gray-700 leading-snug">{p.moderator}</p>
                                  </div>
                                )}
                                {p.panelists.length > 0 && (
                                  <div className="mb-3">
                                    <p className="text-[10px] uppercase tracking-wide text-gray-400 font-bold mb-0.5">Speakers</p>
                                    <ul className="flex flex-col gap-1">
                                      {p.panelists.map((name, ni) => (
                                        <li key={ni} className="text-xs text-gray-700 leading-snug">{name}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {p.description && (
                                  <p className="text-xs text-gray-500 leading-relaxed mb-3">{p.description}</p>
                                )}
                              </div>
                              {/* Photo, then Watch Video, then any extra CTA — all flow
                                  naturally right after the text, same as the heading/speaker
                                  block above. No bottom-pinning: that was making Watch Video
                                  jump to a different height depending on whether a second
                                  button existed. This way Watch Video always sits at the same
                                  offset below the photo across every presentation, and an
                                  extra Case Study/Website button just adds below it instead
                                  of dragging Watch Video's position around. */}
                              <div className="pt-3">
                                {p.photos.length > 0 ? (
                                  <PhotoGallery photos={p.photos} />
                                ) : (
                                  <p className="text-[11px] text-gray-300">No photos yet</p>
                                )}
                              </div>
                              {(p.videoUrl || p.caseStudyUrl || p.websiteUrl) && (
                                <div className="flex flex-col gap-3 pt-3">
                                  {p.videoUrl && <VideoButton url={p.videoUrl} />}
                                  {p.caseStudyUrl ? (
                                    <CaseStudyButton url={p.caseStudyUrl} />
                                  ) : (
                                    p.websiteUrl && <WebsiteButton url={p.websiteUrl} />
                                  )}
                                </div>
                              )}
                              {/* Featuring logos — moved to the bottom and sized to match
                                  the Panel cards' "Featuring" footer, instead of the small
                                  inline row that used to sit above the photo. */}
                              {p.logos.length > 0 && (
                                <div className="pt-4 mt-4 border-t border-gray-100">
                                  <p className="text-[10px] uppercase tracking-wide text-gray-400 font-bold mb-3">Featuring</p>
                                  {/* Same fixed-box treatment as the Panel cards' Featuring
                                      row, just scaled down to fit this narrower card. */}
                                  <div className="flex flex-wrap items-center gap-3">
                                    {p.logos.map((url, li) => (
                                      <div key={li} className="h-10 sm:h-12 w-[85px] sm:w-[100px] flex items-center justify-center">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={url} alt="" className="max-h-full max-w-full object-contain" />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        {sharedLinkedin && (
                          <div className="px-5 py-4 border-t border-gray-100 text-center">
                            <a href={sharedLinkedin} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-aibp-red">
                              Join the Conversation on LinkedIn →
                            </a>
                          </div>
                        )}
                      </div>
                    </Reveal>
                  )
                })}
            </div>
          </div>
        </section>
      ))}

      {/* Networking sessions (roundtables / luncheons / workshops / site visits).
          Always rendered (nav slot always shown) — falls back to a "coming soon"
          placeholder when NETWORKING_SESSIONS hasn't been filled in yet. */}
      <section id="networking" className="border-b border-gray-100">
        <SectionBanner title="Curated Meetings & Introductions" subtitle="Networking & private sessions" meta={meta} />
        {/* Guard against blank rows in NETWORKING_SESSIONS that have an ID
            but no title filled in yet — otherwise they render as an empty
            card (a box with no content) in the grid. */}
        {networkingSessions.filter((n) => n.title).length === 0 ? (
          <div className={`px-5 py-16 text-center ${BAND_CLASSES[bandIndex++ % BAND_CLASSES.length]}`}>
            <p className="text-sm text-gray-400">Networking session details are still being put together — check back soon.</p>
          </div>
        ) : (
          <div className={`px-5 sm:px-10 py-10 sm:py-14 ${BAND_CLASSES[bandIndex++ % BAND_CLASSES.length]}`}>
            <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-5">
              {networkingSessions.filter((n) => n.title).map((n) => (
                <Reveal key={n.id}>
                  <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm h-full">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <div className="min-w-0">
                        {n.type && <p className="text-[10px] uppercase tracking-wide text-aibp-red font-bold mb-1">{n.type}</p>}
                        <h3 className="text-lg font-bold text-gray-900 leading-snug">{n.title}</h3>
                      </div>
                      {n.coHostLogo && (
                        <div className="h-8 sm:h-10 w-[90px] sm:w-[100px] flex items-center justify-center flex-shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={n.coHostLogo} alt="" className="max-h-full max-w-full object-contain" />
                        </div>
                      )}
                    </div>
                    {n.coHostedWith && <p className="text-xs text-gray-400 mb-3">Co-hosted with {n.coHostedWith}</p>}
                    {n.focusBullets.length > 0 && (
                      <ul className="list-disc list-inside text-sm text-gray-600 leading-relaxed mb-3 space-y-0.5">
                        {n.focusBullets.map((b, i) => <li key={i}>{b}</li>)}
                      </ul>
                    )}
                    {n.photos.length > 0 && <div className="mb-3"><PhotoGallery photos={n.photos} /></div>}
                    {n.participants.length > 0 && (
                      <p className="text-[11px] text-gray-400 mb-3">
                        {n.participants.length} participants — {n.participants.slice(0, 4).map((p) => p.company).filter(Boolean).join(', ')}
                        {n.participants.length > 4 ? ' and more' : ''}
                      </p>
                    )}
                    {n.articleUrl && (
                      <a href={n.articleUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-aibp-red">
                        Read the summary article →
                      </a>
                    )}
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Participants — placeholder section, content/data model to be briefed
          separately; will eventually read from a PARTICIPANTS tab. Always
          shown (unlike the data-driven sections above) so the nav slot is
          reserved while the tab is still being defined. */}
      <section id="participants" className="border-b border-gray-100">
        <SectionBanner title="Participants" subtitle="Who was in the room" meta={meta} />
        {participants.length === 0 ? (
          <div className={`px-5 py-16 text-center ${BAND_CLASSES[bandIndex++ % BAND_CLASSES.length]}`}>
            <p className="text-sm text-gray-400">Participant details are coming soon — check back later.</p>
          </div>
        ) : (
          <div className={`px-5 sm:px-10 py-10 sm:py-14 ${BAND_CLASSES[bandIndex++ % BAND_CLASSES.length]}`}>
            <ParticipantsDirectory participants={participants} />
          </div>
        )}
      </section>

      {/* Testimonials */}
      {testimonials.length > 0 && (
        <section id="feedback" className="border-b border-gray-100">
          <SectionBanner title="Participants' Feedback" subtitle="In their words" meta={meta} />
          <div className={`px-5 sm:px-10 py-10 sm:py-14 ${BAND_CLASSES[bandIndex++ % BAND_CLASSES.length]}`}>
            <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
              {testimonials.map((t, i) => (
                <Reveal key={i}>
                  <div className={`rounded-2xl p-5 h-full ${i % 3 === 0 ? 'bg-aibp-red text-white' : 'bg-white border border-gray-100'}`}>
                    <p className={`text-2xl leading-none mb-2 ${i % 3 === 0 ? 'text-white/40' : 'text-aibp-red/30'}`}>&ldquo;</p>
                    <p className={`text-sm leading-relaxed mb-3 ${i % 3 === 0 ? 'text-white' : 'text-gray-700'}`}>{t.quoteText}</p>
                    <p className={`text-xs font-bold ${i % 3 === 0 ? 'text-white' : 'text-gray-900'}`}>{t.name}</p>
                    <p className={`text-[11px] ${i % 3 === 0 ? 'text-white/70' : 'text-gray-400'}`}>{[t.title, t.company].filter(Boolean).join(', ')}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Sponsors — logo-wall style matching the public site's sponsor section:
          colour-coded tier titles, centered flex-wrap grid of fixed-size
          light logo boxes. */}
      {sponsors.length > 0 && (
        <section id="sponsors">
          <SectionBanner title="Partners & Sponsors" subtitle="With thanks to" meta={meta} />
          <div className={`px-5 sm:px-10 py-10 sm:py-14 text-center ${BAND_CLASSES[bandIndex++ % BAND_CLASSES.length]}`}>
            <div className="max-w-5xl mx-auto">
              {TIER_ORDER.filter((tier) => sponsorsByTier[tier]?.length).map((tier) => (
                <Reveal key={tier} className="mb-10 last:mb-0">
                  <p
                    className="text-lg sm:text-xl font-bold uppercase tracking-[0.2em] mb-6"
                    style={{ color: TIER_COLORS[tier] || DEFAULT_TIER_COLOR }}
                  >
                    {tierSectionLabel(tier, sponsorsByTier[tier].length)}
                  </p>
                  <div className="flex flex-wrap justify-center gap-5">
                    {sponsorsByTier[tier].map((s) => (
                      <div
                        key={s.spId}
                        className="flex items-center justify-center bg-gray-50 border border-gray-200 rounded-lg p-5 w-[45%] sm:w-[220px] h-[110px] sm:h-[140px]"
                      >
                        {s.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={s.logoUrl} alt={s.company} className="max-h-full max-w-full object-contain" />
                        ) : (
                          <span className="text-xs text-gray-400 font-bold text-center px-1">{s.company}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      <footer className="px-5 py-10 text-center border-t border-gray-100 bg-gray-900">
        <p className="text-xs text-gray-400 leading-relaxed max-w-md mx-auto">
          AIBP serves as an avenue for public and private organisations in Southeast Asia to access and exchange
          information about growth and innovation within the B2B space.
        </p>
        <p className="text-xs text-gray-500 mt-3">aibp@industry-platform.com · www.aibp.sg</p>
      </footer>
    </div>
  )
}
