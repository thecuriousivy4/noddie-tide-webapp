"use client";

// The public page. One scroll, in movements: reverence → understanding → standing with.
//
// Design rules held deliberately, and stated on the page itself:
//  · no imitation of Aboriginal dot painting, iconography or any community's visual art.
//    Colour comes from landscape (red earth, ochre, charcoal, eucalypt, deep sky), and the
//    only drawn figure is a survey-style landform section.
//  · no invented quotes attributed to Traditional Owners. Where community voice belongs,
//    the space is reserved and labelled, not filled with words we made up.
//  · real-world events are from the public record and dated; the register's places are
//    synthetic and marked as such.

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { useRouter } from "next/navigation";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { ArrowDown, ArrowRight, EyeOff, Plus } from "lucide-react";
import { useIdentity } from "@/lib/identity/client";
import { SEED_SITES, CUSTODIAN_SIGNERS } from "@/lib/fixtures";
import { QuorumGraph } from "@/components/QuorumGraph";

/* ------------------------------------------------------------------ motion */

/** Sections settle into place rather than arriving. */
function Settle({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const still = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={still ? false : { opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 1.1, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Slow parallax on landscape imagery, keyed to the plate's own travel. */
function usePlateParallax(ref: RefObject<HTMLElement | null>, travel = 7): MotionValue<string> {
  const still = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  return useTransform(scrollYProgress, [0, 1], still ? ["0%", "0%"] : [`-${travel}%`, `${travel}%`]);
}

function Plate({
  src,
  alt,
  caption,
  shape = "tall",
}: {
  src: string;
  alt: string;
  caption?: string;
  shape?: "tall" | "wide";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const y = usePlateParallax(ref);
  return (
    <div>
      <div className={`c-plate ${shape}`} ref={ref}>
        <motion.img src={src} alt={alt} style={{ y, height: "116%", marginTop: "-8%" }} />
      </div>
      {caption && <div className="c-plate-cap">{caption}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------- page */

export default function Country() {
  const { ready, authenticated, mode, login } = useIdentity();
  const router = useRouter();

  useEffect(() => {
    if (ready && authenticated) router.replace("/home");
  }, [ready, authenticated, router]);

  // Under TideCloak this redirects to the realm. Under the simulated provider there is
  // nothing to redirect to, so the person goes to the sign-in form.
  async function enter() {
    const redirected = await login();
    if (!redirected) router.push("/signin");
  }

  if (authenticated) return <div className="loading-screen">Taking you to the register…</div>;

  return (
    <div className="country">
      <Acknowledgement />
      <Hero onEnter={enter} mode={mode} />
      <AtStake />
      <TheRecord />
      <ThePlaces />
      <LearnAtYourPace />
      <CommunityVoice />
      <Consent />
      <StandWith onEnter={enter} />
      <Deference mode={mode} />
    </div>
  );
}

/* ------------------------------------------------- acknowledgement of Country */

function Acknowledgement() {
  const [open, setOpen] = useState(false);
  return (
    <section className="c-ack" aria-label="Acknowledgement of Country">
      <div className="c-ack-inner">
        <div className="c-ack-label">Acknowledgement of Country</div>
        <p>
          We acknowledge the Traditional Owners and Custodians of Country throughout Australia, and
          their continuing connection to land, waters, skies and community. We pay our respects to
          Elders past and present, and to the knowledge held and carried by them. Sovereignty was
          never ceded.
        </p>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? "Close" : "Read the rest of this acknowledgement"}
        </button>
        <motion.div
          initial={false}
          animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
          transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
          style={{ overflow: "hidden" }}
        >
          <div className="c-ack-more">
            <p>
              An acknowledgement should name the Country it is given on, and the people whose
              Country it is. This page cannot: the register shown here is a working prototype built
              on synthetic places, so that no community&rsquo;s Country, name or knowledge appears
              in it without their consent.
            </p>
            <p>
              Nothing on this page speaks for Traditional Owners. Where decisions are described, the
              decisions belong to them. Where their words belong, we have left the space open rather
              than fill it with our own.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- the hero */

function Hero({ onEnter, mode }: { onEnter: () => void; mode: "tidecloak" | "mock" | "unknown" }) {
  const enterLabel = mode === "tidecloak" ? "Sign in with TideCloak" : "Enter the register";
  const still = useReducedMotion();
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 900], still ? [0, 0] : [0, 190]);
  const fade = useTransform(scrollY, [0, 520], [1, 0]);

  return (
    <section className="c-hero">
      <motion.img
        className="c-hero-img"
        src="/images/outback-hero.jpg"
        alt="Open country at dawn: red earth under a wide, lightening sky"
        style={{ y }}
      />
      <div className="c-hero-veil" />

      <div className="c-hero-mast">
        <div className="c-mast">
          <div>
            <div className="c-mast-name">Noddie</div>
            <div className="c-mast-sub">A heritage register held by community</div>
          </div>
          <button type="button" className="c-btn ghost sm" onClick={onEnter}>
            {enterLabel}
          </button>
        </div>
      </div>

      <div className="c-hero-inner">
        <div className="c-wrap">
          <motion.div
            initial={still ? false : { opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="c-overline">Aboriginal sacred sites &amp; cultural heritage</div>
            <h1>
              Cared for across <em>sixty-five thousand years</em>. Signed away in an afternoon.
            </h1>
            <p className="c-lede">
              Across Australia, places of deep cultural significance are still protected by systems
              in which one consent, given once, can outlast the people whose Country it is. This is
              a prototype of a different rule: nothing revealed, and nothing permitted, unless the
              community&rsquo;s custodians agree.
            </p>
            <div className="row-wrap" style={{ marginTop: 34, gap: 12 }}>
              <a className="c-btn" href="#stake">
                What is at stake <ArrowRight size={16} strokeWidth={1.6} />
              </a>
              <button type="button" className="c-btn ghost" onClick={onEnter}>
                {enterLabel}
              </button>
            </div>
          </motion.div>
        </div>
      </div>

      <motion.div className="c-scrollcue" style={{ opacity: fade }}>
        Scroll slowly
        <motion.span
          animate={still ? {} : { y: [0, 7, 0] }}
          transition={{ repeat: Infinity, duration: 2.6, ease: "easeInOut" }}
        >
          <ArrowDown size={14} strokeWidth={1.5} />
        </motion.span>
      </motion.div>
    </section>
  );
}

/* ------------------------------------------------------------ I — at stake */

function AtStake() {
  return (
    <section className="c-mvt first" id="stake">
      <div className="c-wrap">
        <Settle>
          <div className="c-mvt-head">
            <span className="num">I</span>
            <span>What is at stake</span>
          </div>
        </Settle>
        <div className="c-duo">
          <div>
            <Settle>
              <h2>Heritage here is not a building. It is Country, and it is still in use.</h2>
            </Settle>
            <Settle delay={0.08}>
              <p className="c-prose" style={{ marginTop: 22 }}>
                A rock shelter with a floor deposit metres deep. A spring that has never failed. A
                ridge that carries law. These are not ruins or exhibits — they are places held in
                active relationship, where the knowledge of what a place <em>is</em> may itself be
                restricted, and is not ours to publish.
              </p>
              <p className="c-prose">
                That creates a hard bind. To have a place protected, a community is usually required
                to lodge it with a government body — <strong>the same body that can later consent to
                its destruction.</strong> So some places are never lodged at all. Hidden places
                cannot be defended, and a register that leaks is worse than no register.
              </p>
            </Settle>
          </div>
          <Settle delay={0.14}>
            <Plate
              src="/images/outback-1.jpg"
              alt="Weathered rock country, low sun across stone"
              caption="Stone weathered over a span no document covers. Photograph of landscape only — no site locations are shown anywhere on this page."
            />
          </Settle>
        </div>

        <Settle delay={0.1}>
          <div className="c-deeptime">
            <div className="cell">
              <div className="fig">65,000+</div>
              <div className="cap">
                Years of continuous custodianship evidenced in Australia — among the oldest
                unbroken human connections to place anywhere.
              </div>
            </div>
            <div className="cell">
              <div className="fig">46,000</div>
              <div className="cap">
                Years of continuous occupation recorded in the Juukan Gorge rock shelters, in
                Western Australia, destroyed in May 2020.
              </div>
            </div>
            <div className="cell">
              <div className="fig">1</div>
              <div className="cap">
                Ministerial consent — granted in 2013, lawful, never revisited — was all that the
                destruction required.
              </div>
            </div>
          </div>
          <p className="c-note" style={{ marginTop: 16 }}>
            Figures and events on this page are drawn from the public record. The register&rsquo;s
            places, people and knowledge, further down, are synthetic.
          </p>
        </Settle>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- II — the record */

const RECORD = [
  {
    when: "1972",
    title: "Consent to damage is written into law",
    body: "Western Australia's Aboriginal Heritage Act creates a process by which a minister may consent to the use of land containing an Aboriginal site — in practice, consent to damage it. Similar discretion exists across jurisdictions.",
  },
  {
    when: "1984",
    title: "A national safety net that is rarely used",
    body: "The Commonwealth gains power to make emergency declarations protecting significant Aboriginal areas. Applications are made often; declarations are made seldom.",
  },
  {
    when: "May 2020",
    title: "Juukan Gorge",
    body: "Two rock shelters holding 46,000 years of continuous occupation are destroyed for a mine expansion, under a consent granted seven years earlier. The Traditional Owners' objections did not change the outcome, because the law did not require them to.",
    turn: true,
  },
  {
    when: "2021",
    title: "A Way Forward",
    body: "A Commonwealth parliamentary inquiry finds the destruction was legal and systemic, and recommends heritage protection built on the free, prior and informed consent of Traditional Owners.",
  },
  {
    when: "2023",
    title: "Reform, then reversal",
    body: "Western Australia's new cultural heritage Act commences in July and is wound back within months, returning final say to ministerial consent. The pattern the inquiry described remains in place.",
  },
  {
    when: "Still now",
    title: "Protection depends on who holds the pen",
    body: "A community can object, negotiate, document and plead. In the end, the decision — and the key to the record — usually sits with someone else.",
    turn: true,
  },
];

function TheRecord() {
  return (
    <section className="c-mvt">
      <div className="c-wrap">
        <Settle>
          <div className="c-mvt-head">
            <span className="num">II</span>
            <span>The record</span>
          </div>
          <h2>Not an accident. A pattern, written down and dated.</h2>
          <p className="c-prose" style={{ marginTop: 20 }}>
            The point of this timeline is not blame. It is that every step was lawful — which is
            exactly why better intentions are not a fix. The authority to destroy a place sits in
            the wrong hands, and intentions do not move it.
          </p>
        </Settle>
        <div className="c-timeline">
          {RECORD.map((r, i) => (
            <Settle key={r.when} delay={Math.min(i * 0.06, 0.3)}>
              <div className={`c-tl-row${r.turn ? " turn" : ""}`}>
                <div className="c-tl-when">{r.when}</div>
                <div className="c-tl-what">
                  <h4>{r.title}</h4>
                  <p>{r.body}</p>
                </div>
              </div>
            </Settle>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- III — the places */

type ThreatLevel = "high" | "watch" | "held";

const THREATS: Record<string, { level: ThreatLevel; label: string; detail: string; pos: [number, number] }> = {
  "RB-07": {
    level: "high",
    label: "Works notice lodged",
    detail:
      "A haul-road corridor is proposed across this country. A proponent has lodged a works notice and is seeking a permit.",
    pos: [258, 252],
  },
  "RB-12": {
    level: "watch",
    label: "Exploration licence adjacent",
    detail:
      "An exploration licence sits alongside this place. No works have been noticed, and no permit has been sought.",
    pos: [556, 206],
  },
  "SP-04": {
    level: "held",
    label: "Held by another community",
    detail:
      "This place is held by a different Traditional Owner corporation, whose custodians require unanimous agreement rather than a majority. The register does not average the two rules; it applies whichever community holds the place.",
    pos: [604, 344],
  },
  "RB-15": {
    level: "held",
    label: "No works proposed",
    detail:
      "Nothing is proposed here. Part of what is recorded about this place is held under an additional cultural restriction, and is not readable even by most custodians.",
    pos: [146, 330],
  },
};

/** Only the places this page has written copy for appear on it. */
const SHOWN = SEED_SITES.filter((s) => s.id in THREATS);

function ThePlaces() {
  const [sel, setSel] = useState(SHOWN[0].id);
  const site = SHOWN.find((s) => s.id === sel) ?? SHOWN[0];
  const threat = THREATS[site.id];

  return (
    <section className="c-mvt">
      <div className="c-wrap">
        <Settle>
          <div className="c-mvt-head">
            <span className="num">III</span>
            <span>The places — a synthetic register</span>
          </div>
          <h2>Everything you are allowed to see. Nothing you are not.</h2>
          <p className="c-prose" style={{ marginTop: 20 }}>
            This is the register as the public sees it: that something is here, roughly where, and
            what is pressing against it. Names, boundaries, significance and restricted knowledge
            stay encrypted on the custodians&rsquo; own devices. Choose a place.
          </p>
        </Settle>

        <Settle delay={0.1}>
          <div className="c-atlas">
            <div>
              <div className="c-map">
                <CountryMap selected={sel} onSelect={setSel} />
                <div className="c-map-foot">
                  <span className="key">
                    <span className="dot" style={{ background: "#c0624a", borderColor: "#8c2b1c" }} />
                    Works proposed
                  </span>
                  <span className="key">
                    <span className="dot" style={{ background: "#d9bd70", borderColor: "#85661a" }} />
                    Under watch
                  </span>
                  <span className="key">
                    <span className="dot" style={{ background: "#8fa886", borderColor: "#3f5c3a" }} />
                    Quiet
                  </span>
                  <span className="key">Positions indicative only</span>
                </div>
              </div>
              <p className="c-note" style={{ marginTop: 14 }}>
                A landform section, drawn from survey conventions — ridgelines, a watercourse, a
                lease outline. Markers are deliberately imprecise: a published location is a found
                location.
              </p>
            </div>

            <motion.div
              className="c-place"
              key={site.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="ref">{site.publicLabel}</div>
              <h3>{site.publicName}</h3>
              <div className={`c-threat ${threat.level}`}>{threat.label}</div>
              <p className="summary">{site.publicSummary}</p>
              <p className="summary" style={{ marginTop: 12 }}>
                {threat.detail}
              </p>
              <dl>
                <dt>Country</dt>
                <dd>{site.landType}</dd>
                <dt>Held by</dt>
                <dd>{site.community}</dd>
                <dt>Consent</dt>
                <dd>Two of three custodians, for every disclosure and every permit</dd>
              </dl>
              <div className="c-withheld">
                <EyeOff size={15} strokeWidth={1.5} />
                <span>
                  Name, boundary, significance
                  {site.hasRestricted ? " and restricted knowledge" : ""} are withheld here — not
                  by policy, but because this page has no key. Neither does the server.
                </span>
              </div>
            </motion.div>
          </div>
        </Settle>
      </div>
    </section>
  );
}

/** Survey-style landform section. Deliberately not a cultural motif. */
function CountryMap({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  return (
    <svg viewBox="0 0 760 440" role="group" aria-label="Indicative map of recorded places">
      <defs>
        <pattern id="leaseHatch" width="8" height="8" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="8" stroke="#8c2b1c" strokeOpacity="0.35" strokeWidth="2" />
        </pattern>
        <linearGradient id="skyBand" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#dfe4e2" />
          <stop offset="100%" stopColor="#efe6d5" />
        </linearGradient>
      </defs>

      <rect width="760" height="440" fill="url(#skyBand)" />

      {/* ridgelines, far to near */}
      <path d="M0 196 L130 160 L250 182 L370 142 L500 176 L620 138 L760 168 L760 440 L0 440 Z" fill="#cbbda4" opacity="0.5" />
      <path d="M0 196 L130 160 L250 182 L370 142 L500 176 L620 138 L760 168" fill="none" stroke="#a08c6c" strokeWidth="1" />
      <path d="M0 252 L110 226 L230 250 L350 216 L470 246 L600 212 L760 244 L760 440 L0 440 Z" fill="#d9c7a8" opacity="0.7" />
      <path d="M0 252 L110 226 L230 250 L350 216 L470 246 L600 212 L760 244" fill="none" stroke="#9a7f5c" strokeWidth="1.1" />
      <path d="M0 330 L120 312 L250 334 L380 304 L520 332 L650 306 L760 326 L760 440 L0 440 Z" fill="#e3cfae" />
      <path d="M0 330 L120 312 L250 334 L380 304 L520 332 L650 306 L760 326" fill="none" stroke="#8c6f4c" strokeWidth="1.2" />

      {/* watercourse */}
      <path
        d="M24 424 C150 396 190 350 300 338 C410 326 470 286 580 272 C650 263 700 240 736 226"
        fill="none"
        stroke="#6d8a92"
        strokeWidth="2"
        strokeDasharray="1 0"
        opacity="0.75"
      />
      <text x="36" y="414" fontFamily="var(--font-mono)" fontSize="10" fill="#5d7a82" letterSpacing="1.4">
        WATERCOURSE
      </text>

      {/* proposed lease / haul corridor */}
      <rect x="196" y="198" width="196" height="128" fill="url(#leaseHatch)" stroke="#8c2b1c" strokeWidth="1" strokeDasharray="5 4" />
      <text x="200" y="192" fontFamily="var(--font-mono)" fontSize="10" fill="#8c2b1c" letterSpacing="1.4">
        PROPOSED HAUL CORRIDOR
      </text>

      {/* recorded places */}
      {SHOWN.map((s) => {
        const t = THREATS[s.id];
        const [x, y] = t.pos;
        const active = selected === s.id;
        const ring = t.level === "high" ? "#8c2b1c" : t.level === "watch" ? "#85661a" : "#3f5c3a";
        const fill = t.level === "high" ? "#c0624a" : t.level === "watch" ? "#d9bd70" : "#8fa886";
        return (
          <g
            key={s.id}
            tabIndex={0}
            role="button"
            aria-pressed={active}
            aria-label={`${s.publicLabel} — ${s.publicName}, ${t.label}`}
            onClick={() => onSelect(s.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(s.id);
              }
            }}
            style={{ cursor: "pointer" }}
          >
            {/* the imprecision is the point: an area, never a pin */}
            <motion.circle
              cx={x}
              cy={y}
              r={active ? 42 : 34}
              fill={fill}
              fillOpacity={active ? 0.2 : 0.11}
              stroke={ring}
              strokeOpacity={active ? 0.75 : 0.4}
              strokeWidth={1}
              strokeDasharray="3 5"
              initial={false}
              animate={{ r: active ? 42 : 34 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            />
            <circle cx={x} cy={y} r={active ? 7.5 : 6} fill={fill} stroke={ring} strokeWidth="1.5" />
            <text
              x={x}
              y={y + (y > 300 ? -46 : 58)}
              textAnchor="middle"
              fontFamily="var(--font-mono)"
              fontSize="11"
              letterSpacing="1.2"
              fill={active ? ring : "#6b6052"}
            >
              {s.publicLabel.toUpperCase()}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* --------------------------------------------------- IV — learn at your pace */

const TOPICS = [
  {
    q: "Why would a community keep a place hidden?",
    a: [
      "Because disclosure has a cost. A location, once lodged, can be read by officials, consultants, contractors and anyone who obtains the file — and a place that is known is a place that can be visited, photographed, souvenired or targeted.",
      "Some knowledge is also restricted by law and custom: it may be held only by particular people, and recording it at all requires the right consent. A register that cannot honour that is a register communities are right to refuse.",
    ],
  },
  {
    q: "What does consent mean in heritage law today?",
    a: [
      "Largely: consultation, then a decision by someone else. Traditional Owners may be consulted, may object, may give evidence — and a minister or delegate may still consent to the use of the land, with that consent persisting for years afterward.",
      "The 2021 Commonwealth inquiry into the destruction at Juukan Gorge recommended the opposite ordering: protection grounded in the free, prior and informed consent of Traditional Owners, with the power to say no.",
    ],
  },
  {
    q: "What does free, prior and informed consent ask for?",
    a: [
      "Paraphrasing the principle as it appears in the UN Declaration on the Rights of Indigenous Peoples and in Dhawura Ngilan, the national vision for Aboriginal and Torres Strait Islander heritage: consent must be sought before a decision is made, without coercion, with full knowledge of consequences — and it must be able to be withheld.",
      "Withheld is the load-bearing word. A consent that cannot be refused is a notification.",
    ],
  },
  {
    q: "How does Noddie hold that rule technically?",
    a: [
      "Records are encrypted in the custodian's browser. The database holds ciphertext; the application server never sees a key. There is no administrator view of the register's contents, because there is no administrator key.",
      "Granting a permit is not a column that can be flipped. It is a governed change request that takes effect only when two of three custodian elders approve it, carried afterwards in a token signed by the Tide network — so the gate trusts the quorum, not our own code.",
      "A minister, a proponent or a platform administrator can press every button available to them and produce nothing. That is demonstrated in the register itself.",
    ],
  },
  {
    q: "What this design deliberately does not do",
    a: [
      "It does not imitate Aboriginal dot painting, iconography or any community's visual art. The imagery here is landscape photography and survey-style line work; the warmth comes from colour drawn from earth, stone and eucalypt, and from typography and space.",
      "It uses no real place names, community names, people or cultural knowledge. Every record in the prototype is synthetic, including the restricted layer, which contains a labelled placeholder rather than anything real.",
      "It does not claim community endorsement. A real deployment would be designed with Traditional Owners from the first conversation, on their terms, and would be theirs to govern.",
    ],
  },
];

function LearnAtYourPace() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="c-mvt">
      <div className="c-wrap">
        <Settle>
          <div className="c-mvt-head">
            <span className="num">IV</span>
            <span>At your own pace</span>
          </div>
          <h2>Take as long as you need with this.</h2>
        </Settle>
        <div className="c-disclose">
          {TOPICS.map((t, i) => {
            const isOpen = open === i;
            return (
              <div className="c-disclose-row" key={t.q} data-open={isOpen}>
                <button
                  type="button"
                  className="c-disclose-btn"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : i)}
                >
                  <h3>{t.q}</h3>
                  <span className="c-disclose-mark">
                    <Plus size={15} strokeWidth={1.5} />
                  </span>
                </button>
                <motion.div
                  className="c-disclose-body"
                  initial={false}
                  animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div>
                    {t.a.map((p) => (
                      <p key={p.slice(0, 24)}>{p}</p>
                    ))}
                  </div>
                </motion.div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------ V — community voice */

function CommunityVoice() {
  return (
    <section className="c-mvt dark">
      <div className="c-wrap">
        <Settle>
          <div className="c-mvt-head">
            <span className="num">V</span>
            <span>Whose voice leads</span>
          </div>
          <h2>These spaces are not ours to fill.</h2>
          <p className="c-prose" style={{ marginTop: 20 }}>
            A page like this usually carries quotes from community members. We have none, because
            none were given — and inventing them, or borrowing them from a news report to decorate a
            prototype, would be the same error this project exists to refuse. So the spaces stay
            open, with the protocol for filling them written in.
          </p>
        </Settle>
        <Settle delay={0.1}>
          <div className="c-voice">
            <div className="said">
              <blockquote>Reserved for the Traditional Owners of the Country concerned.</blockquote>
              <div className="who">To be given, or withheld, at their discretion</div>
            </div>
            <div className="said">
              <blockquote>Reserved for the custodians who hold the knowledge of a place.</blockquote>
              <div className="who">Recorded only with consent, shown only as they direct</div>
            </div>
            <div className="said">
              <blockquote>
                Consent must be sought beforehand, free of coercion, with full knowledge of the
                consequences — and it must be able to be refused.
              </blockquote>
              <div className="who">Paraphrase of a published principle, not a person&rsquo;s words</div>
            </div>
            <div className="said">
              <blockquote>
                Until community voice leads it, this remains a prototype — an argument about how a
                register could work, not a register anyone should trust with Country.
              </blockquote>
              <div className="who">The people who built this page</div>
            </div>
          </div>
        </Settle>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ VI — consent */

function Consent() {
  return (
    <section className="c-mvt">
      <div className="c-wrap">
        <Settle>
          <div className="c-mvt-head">
            <span className="num">VI</span>
            <span>Where consent sits</span>
          </div>
          <h2>Authority that does not exist until the community makes it exist.</h2>
          <p className="c-prose" style={{ marginTop: 20 }}>
            A permit here is not a record that someone with enough access can write. It comes into
            being only when a quorum of custodian elders agrees, and it is carried in a token signed
            by the network rather than by us. Try it: approve as the elders, then let an authority
            act alone.
          </p>
        </Settle>
        <Settle delay={0.1}>
          <div className="c-consent">
            <QuorumDemo />
          </div>
        </Settle>
      </div>
    </section>
  );
}

function QuorumDemo() {
  const [approvals, setApprovals] = useState<string[]>([]);
  const [committed, setCommitted] = useState(false);
  const [refused, setRefused] = useState(false);
  const signers = CUSTODIAN_SIGNERS;
  const quorumMet = approvals.length >= 2;

  return (
    <div className="stack" style={{ gap: 20 }}>
      <QuorumGraph
        signers={signers}
        approvals={approvals}
        threshold={2}
        committed={committed}
        blocked={[
          { name: "Minister", role: "minister" },
          { name: "System admin", role: "admin" },
        ]}
      />
      <div className="row-wrap" style={{ justifyContent: "center", gap: 8 }}>
        {signers.map((s) => (
          <button
            key={s.sub}
            type="button"
            className={`c-btn sm${approvals.includes(s.sub) ? "" : " quiet"}`}
            disabled={committed}
            onClick={() =>
              setApprovals((cur) =>
                cur.includes(s.sub) ? cur.filter((x) => x !== s.sub) : [...cur, s.sub],
              )
            }
          >
            {approvals.includes(s.sub) ? "Approved" : "Approve"} · {s.name}
          </button>
        ))}
        <button
          type="button"
          className="c-btn sm"
          disabled={!quorumMet || committed}
          onClick={() => setCommitted(true)}
        >
          Commit
        </button>
        <button
          type="button"
          className="c-btn sm quiet"
          onClick={() => {
            setApprovals([]);
            setCommitted(false);
            setRefused(false);
          }}
        >
          Start again
        </button>
      </div>
      <div className="stack-sm" style={{ alignItems: "center", textAlign: "center" }}>
        <motion.button
          type="button"
          className="c-btn sm quiet"
          animate={refused ? { x: [0, -5, 5, -3, 3, 0] } : {}}
          transition={{ duration: 0.5 }}
          onClick={() => {
            setRefused(true);
            setTimeout(() => setRefused(false), 2600);
          }}
        >
          A minister grants it alone
        </motion.button>
        <motion.span
          className="c-note"
          initial={false}
          animate={{ opacity: refused ? 1 : 0.55 }}
          transition={{ duration: 0.4 }}
        >
          {refused
            ? "Refused. The signature was valid and had no effect — there is no quorum behind it."
            : "Press it and watch nothing happen."}
        </motion.span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------- VII — stand with */

const PLEDGE =
  "I will listen first, and I will support the right of Traditional Owners to decide what is recorded about their Country, what is shown of it, and what is never shown.";

function StandWith({ onEnter }: { onEnter: () => void }) {
  const ref = useRef<HTMLElement>(null);
  const y = usePlateParallax(ref, 5);
  const [name, setName] = useState("");
  const [signed, setSigned] = useState<string | null>(null);

  useEffect(() => {
    try {
      setSigned(window.localStorage.getItem("noddie.pledge"));
    } catch {
      /* storage unavailable — the page works without it */
    }
  }, []);

  function sign() {
    const who = name.trim();
    if (!who) return;
    setSigned(who);
    try {
      window.localStorage.setItem("noddie.pledge", who);
    } catch {
      /* ignore */
    }
  }

  return (
    <section className="c-stand" ref={ref} id="stand">
      <motion.img
        className="c-stand-img"
        src="/images/outback-wide.jpg"
        alt=""
        aria-hidden="true"
        style={{ y, height: "110%", marginTop: "-5%" }}
      />
      <div className="c-stand-veil" />
      <div className="c-stand-inner">
        <div className="c-wrap">
          <Settle>
            <div className="c-mvt-head">
              <span className="num">VII</span>
              <span>Standing with</span>
            </div>
            <h2>This asks something small of you, and something harder.</h2>
            <p className="c-prose c-narrow">
              The small thing: put your name to a commitment about how you will treat this subject.
              It is kept on your own device — this prototype collects nothing, sends nothing and
              counts nobody. We would rather ask honestly than harvest you.
            </p>
            <p className="c-prose c-narrow" style={{ marginTop: 16 }}>
              The harder thing is underneath it:{" "}
              <strong>that the decision about Country belongs to its Traditional Owners</strong>,
              including when that decision is no, and including when it costs something.
            </p>
          </Settle>

          <Settle delay={0.1}>
            {signed ? (
              <div className="c-pledged">
                <div className="said">&ldquo;{PLEDGE}&rdquo;</div>
                <div className="count">
                  Signed by {signed} · held on this device only ·{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setSigned(null);
                      setName("");
                      try {
                        window.localStorage.removeItem("noddie.pledge");
                      } catch {
                        /* ignore */
                      }
                    }}
                    style={{
                      background: "none",
                      border: 0,
                      padding: 0,
                      color: "#e2b887",
                      cursor: "pointer",
                      font: "inherit",
                      textDecoration: "underline",
                    }}
                  >
                    withdraw
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="c-prose c-narrow" style={{ marginTop: 34, color: "#e4dbca" }}>
                  &ldquo;{PLEDGE}&rdquo;
                </p>
                <form
                  className="c-pledge"
                  onSubmit={(e) => {
                    e.preventDefault();
                    sign();
                  }}
                >
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    aria-label="Your name"
                    maxLength={60}
                  />
                  <button type="submit" className="c-btn" disabled={!name.trim()}>
                    Put my name to it <ArrowRight size={16} strokeWidth={1.6} />
                  </button>
                </form>
              </>
            )}
          </Settle>

          <Settle delay={0.14}>
            <div className="c-ways">
              <div className="way">
                <h3>Learn from the source</h3>
                <p>
                  Start with Traditional Owners&rsquo; own heritage bodies and with{" "}
                  <a href="https://aiatsis.gov.au" target="_blank" rel="noreferrer">
                    AIATSIS
                  </a>
                  , rather than with summaries like this one.
                </p>
              </div>
              <div className="way">
                <h3>Read the inquiry</h3>
                <p>
                  <em>A Way Forward</em> — the Commonwealth inquiry into the destruction at Juukan
                  Gorge — sets out, in plain terms, what consent-based protection would require.
                </p>
              </div>
              <div className="way">
                <h3>Walk through the register</h3>
                <p>
                  Step in as one of six people in the scenario and follow a permit from request to
                  grant — or to refusal.
                </p>
                <button
                  type="button"
                  className="c-btn sm"
                  style={{ marginTop: 14 }}
                  onClick={onEnter}
                >
                  Enter the register
                </button>
              </div>
            </div>
          </Settle>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- deference */

function Deference({ mode }: { mode: "tidecloak" | "mock" | "unknown" }) {
  return (
    <footer className="c-foot">
      <div className="c-wrap">
        <p className="lede">
          Country was cared for long before any register, and will be cared for long after this one.
        </p>
        <div className="fine">
          <span>
            Noddie is a working prototype built for a hackathon. All places, people, records and
            restricted knowledge in it are synthetic. No real community, Country or cultural
            knowledge is represented.
          </span>
          <span>
            No Aboriginal art, motif or iconography is imitated anywhere in this design. Real use
            would require co-design with Traditional Owners, on their terms, under their governance
            — and their right to walk away from it.
          </span>
          <span>
            {mode === "tidecloak"
              ? "Identity: TideCloak. Sign-in is per person against the realm, tokens are signed by the Tide network, and roles change only when a custodian quorum commits."
              : "Identity: dev mode — no TideCloak realm is configured on this machine, so the register runs on locally signed tokens for the seeded accounts and says so on every screen."}
          </span>
        </div>
      </div>
    </footer>
  );
}
