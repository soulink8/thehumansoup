# thehumansoup.ai
_Exported on 09/02/2026 at 21:20:00 GMT from Cursor (2.4.28)_

---

**User**

Brainstorm a concept with a view to building a prototype.  @full.json @package.json @package.json review the me3 apps and protocol for a quick understanding of what they are. The idea now is to create another app that is an aggregator of content pulled directly from the me.json files of me3 'blogs'. I call this 'thehumansoup.ai' (this might be the brand/domain). It's purpose is a place for ai agents to traverse, 'swim in' to find suitable content for their humans based on interests and 'subscription' intent to their 'feed' via email sign up directly on their blogs/me3sites. Instead of these being just 'newsletter' sign ups for email newsletters they are more than that. They encompass more than that, the equivalent of a newsletter, substack, youtube subscribe, tiktok, IG follow all in one. so if a huam subscribes directly to another via their newsletter subscribe block on their blog, this tells their PAI (personal AI assistant, coming soon) that they are interested in whatever this person posts be it and article, long or short form video or a tweet doesn't matter. Blogs on me3 sites are the next iteration of blogs they can be in any standard format (article, essay, video, short note etc, the protocol will standardise this later). Let's start there, big ask I know. We should start high level first, get technical later. 

---

**Cursor**

🧙

Let me first understand the me3 ecosystem by reviewing the referenced files.

Now I have a solid understanding of the me3 ecosystem. Let me lay out a thorough brainstorm.

---

# thehumansoup.ai -- Concept Brainstorm

## The Elevator Pitch

**thehumansoup.ai** is an open, AI-traversable content index built on the me3 protocol. It aggregates the `me.json` files and content from me3 sites into a structured "soup" that AI agents can swim through to discover, match, and surface content for their humans -- based on interests, intent signals, and subscription relationships.

It transforms the me3 ecosystem from a collection of isolated personal sites into a **networked content graph** that AI agents can reason over.

---

## The Core Insight

Right now, content discovery is broken:

- **Newsletters** = email-locked, one format, no AI can reason over your subscriptions
- **Substack/YouTube/TikTok/IG** = siloed platforms, each with their own follow graph, each optimising for *their* engagement, not *your* interests
- **RSS** = great idea, dead UX, no intelligence layer

me3 already has the perfect primitive: `me.json` is a **machine-readable identity + content manifest**. The `intents.subscribe` system already captures subscription intent. What's missing is:

1. **An aggregation layer** that collects and indexes these signals across all me3 sites
2. **An AI-traversable interface** that lets agents reason over the content graph
3. **A unified subscription model** that means "I'm interested in *everything* this person creates" -- not just their emails

---

## The "Subscribe" Redefined

When a human subscribes to someone on a me3 site today, it triggers a newsletter relationship. In the thehumansoup world, that same action becomes a **universal follow**:

| Old World | thehumansoup |
|-----------|-------------|
| Newsletter signup | **Intent signal**: "I care about this person's output" |
| YouTube subscribe | Already covered -- posts can be video |
| Twitter follow | Already covered -- posts can be short notes |
| Substack subscribe | Already covered -- posts can be long-form |
| IG follow | Already covered -- posts can be visual |

The me3 post model (which currently has `slug`, `title`, `file`, `publishedAt`, `excerpt`) just needs a **content type** field to distinguish formats. The protocol can standardise this later as you mentioned, but conceptually:

```
article | essay | note | video | short-video | audio | image | link | thread
```

The subscription isn't "give me your emails" -- it's "**my AI should pay attention to you.**"

---

## Architecture Concept (High Level)

### Three Layers

```
┌─────────────────────────────────────────────────┐
│              HUMAN LAYER                         │
│   Humans browse, subscribe, read on me3 sites   │
│   Their PAI watches their subscription graph     │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│           thehumansoup.ai                        │
│                                                  │
│   ┌───────────┐  ┌───────────┐  ┌────────────┐ │
│   │  Indexer   │  │  Content  │  │  Agent     │ │
│   │  (crawls   │  │  Graph    │  │  API       │ │
│   │  me.json)  │  │  (search  │  │  (AI-first │ │
│   │            │  │   + rank) │  │   access)  │ │
│   └───────────┘  └───────────┘  └────────────┘ │
│                                                  │
│   ┌───────────┐  ┌───────────┐                  │
│   │  Sub       │  │  Feed     │                  │
│   │  Registry  │  │  Builder  │                  │
│   │  (who →    │  │  (curated │                  │
│   │   whom)    │  │   output) │                  │
│   └───────────┘  └───────────┘                  │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│              me3 SITE LAYER                      │
│   Individual me3 sites with me.json + content    │
│   Each site is sovereign, owns its own data      │
└─────────────────────────────────────────────────┘
```

### Key Components

**1. The Indexer**
- Periodically crawls known me3 sites, fetches `me.json` from each
- Detects new posts, updated profiles, changed intents
- Doesn't store the content itself -- stores **references** (the me.json is the source of truth, the site is the origin)
- Think of it like a search engine spider, but specialised for the me3 protocol

**2. The Content Graph**
- A structured index of: people, posts, topics, relationships
- Each person node links to their content nodes
- Content is tagged/classified (by AI) with topics, sentiment, format
- Edges represent: "authored", "subscribed to", "similar to", "referenced"

**3. The Subscription Registry**
- When Human A subscribes to Human B on B's me3 site, that relationship is recorded
- This is the **social graph** -- but it's not a walled garden, it's an open protocol signal
- me3 sites can push subscription events to the soup, or the soup can pull from subscriber lists (with consent)

**4. The Agent API**
- This is the **primary interface** -- designed for AI agents, not humans
- Agents can query: "What's new from the people my human follows?"
- Agents can discover: "Who publishes content about X that my human might like?"
- Agents can reason: "My human is interested in indie SaaS -- who in the soup writes about this?"

**5. The Feed Builder**
- Synthesises a personalised feed for each human based on their subscription graph + their PAI's understanding of their interests
- Not an algorithmic feed that optimises for engagement -- a **curated digest** that respects the human's attention

---

## What Makes This Different from RSS / Google Reader / etc.

| Feature | RSS/Reader | thehumansoup |
|---------|-----------|-------------|
| Who consumes it | Humans directly | AI agents on behalf of humans |
| Content format | Articles only | Any: article, video, note, audio |
| Discovery | Manual (find feeds) | AI-powered (agents find creators for you) |
| Subscription meaning | "Send me XML" | "My AI should pay attention to this person" |
| Intelligence | Chronological dump | Contextual, interest-weighted, curated |
| Identity | Anonymous | me3 identity (name, handle, bio, links) |
| Protocol | RSS/Atom XML | me3 protocol (JSON, structured, extensible) |
| Monetisation | None | Built into me3 (shop, bookings, products) |

---

## The AI Agent Interaction Model

This is where it gets interesting. A PAI (Personal AI Assistant) interacts with the soup like this:

```
PAI: "My human Kieran follows 47 creators. What's new in the last 24 hours?"

Soup: Returns 12 new posts across 8 creators, with metadata:
  - 3 articles about AI tooling (high relevance to Kieran's interests)
  - 2 short notes about startup life
  - 1 video tutorial on Cloudflare Workers
  - 4 product updates from tools Kieran uses
  - 2 personal essays

PAI: (internally ranks, filters based on Kieran's current context)
PAI → Kieran: "Three things worth your time today: [curated summary]"
```

The soup doesn't decide what's important -- **the PAI does**. The soup just makes everything traversable and queryable. This is the fundamental difference from algorithmic feeds: the intelligence is on the human's side, not the platform's side.

---

## The "Soup" Metaphor

The name is brilliant and worth leaning into:

- **The soup** = the total mix of all human-created content from me3 sites
- **Swimming** = AI agents traversing the content graph
- **Ingredients** = individual posts, notes, videos, products
- **Flavour** = the unique voice/perspective each creator brings
- **Taste** = what each human's PAI knows they prefer
- **Recipe** = the personalised feed the PAI assembles

"The Human Soup" evokes warmth, nourishment, variety, and the idea that individual ingredients become something greater together. It's anti-algorithm -- there's no "feed" being served to you, your AI is *cooking for you* from the soup.

---

## Protocol Extensions Needed

Looking at the current me3 protocol, a few things would need to evolve:

**1. Post Content Types** (in `me.json` posts array)
```json
{
  "slug": "my-post",
  "title": "My Post",
  "file": "blog/my-post.md",
  "type": "article",           // NEW: article | note | video | audio | image | link
  "publishedAt": "2026-02-09",
  "excerpt": "...",
  "media": {                   // NEW: for non-text content
    "url": "https://...",
    "duration": 340,
    "thumbnail": "./files/thumb.jpg"
  },
  "tags": ["ai", "tooling"]   // NEW: creator-defined topics
}
```

**2. Soup Registration Intent** (in `me.json` intents)
```json
{
  "intents": {
    "subscribe": { ... },
    "soup": {                   // NEW: opt-in to thehumansoup index
      "enabled": true,
      "indexable": true,        // allow content to be indexed
      "topics": ["ai", "startups", "web3"],  // self-declared topics
      "frequency": "daily"     // how often they typically post
    }
  }
}
```

**3. Subscription Event Webhook**
When someone subscribes on a me3 site, the site can optionally notify the soup:
```json
POST /api/subscriptions
{
  "subscriber": "kieran.me3.site",  // or anonymous
  "creator": "alice.me3.site",
  "timestamp": "2026-02-09T10:00:00Z",
  "source": "newsletter_block"
}
```

---

## Prototype Scope (Where to Start)

For a v0.1 prototype, I'd suggest:

### Phase 1: The Index
- A simple crawler that fetches `me.json` from a list of known me3 sites
- Stores the content graph in a lightweight DB (D1 or even just JSON)
- Exposes a basic API: `GET /api/creators`, `GET /api/feed?topics=ai`

### Phase 2: The Agent API
- A structured API (or even MCP server) that AI agents can query
- Endpoints like: "What's new?", "Who writes about X?", "Give me a digest for subscriber Y"
- Designed to return structured data that agents can reason over

### Phase 3: The Subscription Bridge
- Connect the me3 subscribe intent to the soup's subscription registry
- When someone subscribes on a me3 site, it registers in the soup
- PAIs can query "what are my human's subscriptions?" via the soup

### Phase 4: The PAI Interface
- A protocol for PAIs to authenticate and query on behalf of their human
- Personalised ranking based on the human's subscription graph + inferred interests

---

## Key Design Principles

1. **Sites are sovereign** -- the soup indexes, it doesn't own. Content lives on me3 sites. The soup is a search engine, not a platform.
2. **AI-first, human-friendly** -- the primary consumer is AI agents, but humans can browse too.
3. **Open by default** -- if you publish on a me3 site, your content is in the soup (unless you opt out). Like the web itself.
4. **No algorithm** -- the soup doesn't rank. It provides data. The PAI decides what matters.
5. **Subscription = relationship** -- not just email delivery, but a signal of interest in a whole person's output.
6. **Format-agnostic** -- a post is a post, whether it's 280 characters or a 40-minute video.

---

## Questions to Explore Next

1. **Identity**: Does the soup know who subscribers are (me3 identity), or are subscriptions anonymous to the soup and only known to the creator?
2. **Freshness**: Push vs. pull? Do me3 sites ping the soup when they publish, or does the soup crawl on a schedule?
3. **Privacy**: What if a creator wants to be in the soup but doesn't want their subscriber list visible?
4. **Monetisation**: Is the soup a free public good? Does it have a premium tier for PAIs that want faster/richer access?
5. **Non-me3 content**: Long term, could the soup index non-me3 sources (Substack, YouTube) by wrapping them in me3-compatible metadata?
6. **MCP**: Should the Agent API be an MCP server so any AI assistant can natively connect?

---

This is the kind of infrastructure that makes me3 sites a *network*, not just a collection of independent pages. The `me.json` protocol is already the perfect foundation -- it's machine-readable, structured, and extensible. The soup just connects the dots.

What angle do you want to dig into first?

---

**User**

Amazing feedback! This is perfect. Questions. 1. Identity, I'm not sure yet. I think it does know. We will think about 'verified human' identity later in order to verify that the user is human. The custom domain on a me3site should take us half way there with this. As for a more rock-solid identity I want to avoid KYC or passport/drivers license verification if at all possible, any suggestions there? Maybe some way of humans meeting in real life to verify they are human? To do:2. Freshness. ping on publish makes sense to me, maybe it's bi-directional? 3. Privacy: allow this as an option I think, we need to be as flexible as possible but verified human is essential for this content so maybe a full AI generated detection later is a must for the soup or validation to 'enter' the soup. 4. the soup is open source, free public good. 5. mmm potentially good for a start so we don't depend on me3 site adoption. 6. yes I think so, what you think. Then if it wass a MCP server, woudl an me3 site be a MCP client?  One other question: @Untitled-1 (1-6) Let's flesh these questions out first before moving on to a more concrete plan. 

---

**Cursor**

🧙

Great questions -- these are the foundational design decisions that shape everything downstream. Let me work through each one thoroughly.

---

## 1. Identity & Verified Human (without KYC)

You're right to resist KYC. The moment you ask for a passport, you've become a platform, not a protocol. Here are some approaches that layer together:

### Web of Trust (Human Vouching)

This is the most aligned with your vision. Humans verify humans.

- **In-person verification**: Two me3 users meet IRL, scan each other's QR codes (or tap NFC), and each "vouches" for the other. This creates a cryptographic attestation: "I, Alice, confirm I met Bob in person and he is a real human."
- **Vouch chains**: If Alice has 5 vouches and she vouches for Bob, Bob inherits some trust. Like PGP's web of trust but for humanness.
- **Soulink integration**: This is where your other app becomes *essential*. Soulink is literally about connecting humans IRL -- it could be the primary vouch mechanism. Meet at a Soulink event? That's a verified-human attestation for free.
- **Decay**: Vouches could decay over time. You need periodic re-verification (another meetup, another vouch) to stay "verified." This prevents one-time farming.

### Domain as Soft Identity

You mentioned custom domains, and this is good as a *baseline*:

- Owning a domain = some cost + some effort = mild sybil resistance
- Custom domain + active content over time = harder to fake at scale
- But not sufficient alone -- domain farms are cheap

### Layered Trust Score (not binary)

Instead of "verified" or "not verified," think of a trust *gradient*:

| Signal | Trust Weight |
|--------|-------------|
| Has me3 site | Low |
| Custom domain | Low-Medium |
| Consistent posting history (6+ months) | Medium |
| 1 human vouch | Medium |
| 3+ human vouches from trusted humans | High |
| Soulink event attendance | High |
| Cross-platform consistency (same person on GitHub, LinkedIn, etc.) | Medium |

The soup could expose this as a "humanness confidence" score that PAIs can use when deciding what to surface. Not a gate -- a signal.

### What to Avoid

- **CAPTCHA-style challenges**: These just verify a browser session, not a persistent identity
- **Phone number verification**: Becoming a telco dependency, easily farmed with VoIP
- **Biometrics (Worldcoin-style)**: Creepy, centralised, and philosophically wrong for this project
- **Staking/payment**: Puts a financial barrier on being human -- excludes people

### My suggestion

Start with **domain + posting history + vouch network** (with Soulink as the premier vouch mechanism). This gives you sybil resistance without surveillance. The soup doesn't need perfect verification at launch -- it needs *enough* friction that automated content farms aren't worth the effort.

---

## 2. Freshness: Bi-directional Push

You're right -- bi-directional makes sense. Here's how it could work:

### Site → Soup (Publish Ping)

When a me3 site publishes, it pings the soup:

```
POST soup.api/ping
{
  "site": "kieran.me3.site",
  "event": "publish",
  "post": {
    "slug": "new-post",
    "type": "article",
    "publishedAt": "2026-02-09T12:00:00Z"
  }
}
```

The soup then fetches the updated `me.json` to get the full picture. The ping is a *hint*, the `me.json` is the source of truth.

### Soup → Site (Subscription Sync)

The other direction -- the soup tells the site what's happening in the network:

```
POST site.api/soup-sync
{
  "newSubscribers": 3,
  "totalReach": 1247,
  "trending": true,
  "topReferrer": "alice.me3.site"  // who's PAI is sending people your way
}
```

This gives creators a reason to care about the soup -- it becomes a *distribution channel*, not just an index.

### Soup → PAI (Feed Push)

And the third direction (the one that matters most):

```
// PAI has a webhook registered with the soup
POST pai.api/feed-update
{
  "human": "kieran",
  "newItems": 12,
  "highPriority": 3,  // from creators Kieran engages with most
  "digest": "..."
}
```

So it's actually **tri-directional**: Sites push to Soup, Soup pushes to Sites (analytics/network signals), Soup pushes to PAIs (content updates).

### Fallback: Scheduled Crawling

For sites that don't implement the ping (early adoption, non-me3 sites), the soup crawls on a schedule. Ping is an optimisation, not a requirement.

---

## 3. Privacy & AI Content Detection

### Privacy Options in me.json

The `intents.soup` block could look like:

```json
"soup": {
  "enabled": true,
  "indexable": true,
  "subscriberListVisible": false,    // hide who subscribes to me
  "subscriberCountVisible": true,    // show count but not identities
  "contentIndexDepth": "metadata",   // "full" | "metadata" | "titles_only"
  "allowDerivativeDiscovery": true   // can PAIs recommend me to non-subscribers?
}
```

This gives creators granular control. You can be in the soup but keep your subscriber list private. You can allow indexing of titles only (so PAIs know *what* you write about but have to visit your site to read it -- driving traffic back to you).

### AI Content Detection

This is the hard one. You're essentially asking: "Is this content authentically human?" Some thoughts:

- **At-entry detection** is fragile. AI detection tools are unreliable and getting worse as models improve.
- **Social proof is better than technical detection**. If a human with 5 vouches from other verified humans publishes a post, it's probably human-enough. If an unvouched account with no history publishes 50 posts in a day, flag it.
- **Provenance over detection**: Instead of asking "was this made by AI?", ask "can we trace the creation process?" If someone writes in the me3 editor, there's an edit history. If someone bulk-uploads generated text, there isn't.
- **Community flagging**: Let verified humans flag content they suspect is synthetic. Three flags from trusted humans = review.

The practical approach: **don't try to detect AI content -- make it expensive to be inauthentic.** The vouch network + posting history + domain ownership creates enough friction. Add community flagging later as the network grows.

---

## 4. Open Source, Public Good

This is the right call. A few implications:

- **The soup itself is infrastructure**, like DNS or SMTP. It shouldn't have a profit motive that conflicts with users.
- **Anyone can run their own soup** -- the reference implementation is open source. Your soup (thehumansoup.ai) is the "main" one, but it's not the *only* one.
- **Sustainability**: Fund it through the me3 ecosystem (Pro tier subscriptions fund the infrastructure), grants, or a foundation model. Not ads, not data selling.
- **This makes trust easier**: Because it's open source, creators can verify exactly what the soup does with their data.

---

## 5. Non-me3 Sources (Wrapping External Content)

This is smart for bootstrapping, and potentially the long game too. The soup could ingest:

- **Substack** via RSS → wrap in me3-compatible metadata
- **YouTube** via RSS/API → same
- **Ghost blogs**, **WordPress** via RSS
- **Tweets/threads** via API (if available)

Each external source gets a "phantom" me3 profile -- a synthetic `me.json` that represents the creator, auto-generated from their platform profile. The content is real, the me3 wrapper is generated.

**Important distinction**: These phantom profiles would be clearly marked as **unverified / external**. They're in the soup, but they haven't opted in. PAIs can query them, but they carry lower trust weight. If the creator later creates a real me3 site, they can **claim** their phantom profile and it upgrades to a first-class citizen.

This gives the soup content density from day one without depending on me3 adoption. And it gives creators a migration path *into* the me3 ecosystem.

---

## 6. MCP -- The Agent Interface

Yes, absolutely. Here's why MCP is a natural fit:

### The Soup as MCP Server

The soup exposes tools that any AI assistant can call:

```
Tools:
  - soup_discover(topics, format, recency) → find creators/content
  - soup_feed(human_id) → get personalised feed for a human
  - soup_subscribe(human_id, creator_id) → register a subscription
  - soup_profile(creator_id) → get a creator's me3 profile
  - soup_trending(topics?) → what's hot in the soup
```

Any AI assistant (Claude, GPT, Gemini, local models) that supports MCP can connect to the soup. This is massively better than a REST API because the agent can *reason* about which tools to use and chain them together.

### Would a me3 site be an MCP client?

Not exactly -- the relationship is:

```
┌──────────┐         ┌──────────────┐         ┌──────────────┐
│  PAI     │ ──MCP──▶│ thehumansoup │ ──HTTP──▶│  me3 sites   │
│ (client) │         │ (MCP server) │         │  (content    │
│          │◀──MCP── │              │◀──HTTP── │   origins)   │
└──────────┘         └──────────────┘         └──────────────┘
```

- **PAIs are MCP clients** -- they connect to the soup to query and discover
- **The soup is an MCP server** -- it exposes tools for agents
- **me3 sites are HTTP origins** -- they push/pull from the soup via webhooks/API, and serve content to anyone who requests it

However, a me3 site *could also* be an MCP server for its own content. Imagine:

```
PAI → Soup: "What's new from Alice?"
Soup → PAI: "3 new posts. Here are summaries."
PAI → Alice's site (MCP): "Give me the full content of post X"
Alice's site → PAI: [full markdown content]
```

This is the **two-hop model**: the soup is the discovery layer, the individual site is the content layer. The PAI talks to both. This keeps content sovereign -- the soup never needs to store full content, just metadata.

---

## Your Big Question: Where Does the Human *See* This?

This is the most interesting question in your notes. Let me unpack it:

### The Old Mental Model
Platform → Algorithm → Feed → Screen → Human eyeballs

### The New Mental Model
Soup → PAI → Human, *however they want*

The radical answer is: **it doesn't matter where they see it, because the PAI adapts to them**. Some possibilities:

**A) On their own me3 site (personal dashboard)**
Your me3 site could have a private "For You" page -- your PAI assembles a daily digest and renders it right there. Your site isn't just your *output* -- it's also your *input*. This is poetic: your digital home is where you both publish and consume.

**B) In conversation with their PAI**
"Hey PAI, anything good today?" → "Alice published a great essay on indie SaaS economics. Bob posted a 3-minute video on Cloudflare Workers. Want me to summarise or bookmark either?"

No feed. No scrolling. Just a conversation.

**C) As a daily email digest**
For humans who prefer async: the PAI compiles a daily email. But unlike a newsletter, it's *curated from multiple sources* by your PAI, formatted to your preferences.

**D) In domain-specific apps (like Soulink)**
This is your example and it's brilliant. Soulink cares about "Dreams" (long-form video). It subscribes to the soup for that content type and surfaces it within its own UX. The soup is the pipe, Soulink is the faucet.

**E) On a dedicated reader app**
For humans who want the "reading" experience -- a clean, calm reader interface. But instead of RSS-feed-style chronological dump, it's PAI-curated.

### The Key Insight

**thehumansoup doesn't need a frontend for humans**. It's infrastructure. The *PAI* is the frontend. And the PAI can project content into whatever surface makes sense: your blog, an app, an email, a conversation, a Soulink feed.

This is what makes it fundamentally different from every content platform: **the consumption experience is decoupled from the aggregation layer**. Medium, Substack, YouTube -- they all bundle discovery, hosting, AND consumption into one app because that's how they control attention. The soup deliberately breaks that bundle.

The soup aggregates. The me3 site hosts. The PAI curates. The human chooses where to look.

---

## Soulink as a Soup Consumer

Your Soulink example deserves special attention because it illustrates the model perfectly:

```
Soulink registers with the soup:
{
  "app": "soulink",
  "interests": ["dreams"],          // the content type
  "contentFormats": ["video"],       // long-form video specifically
  "fetchFrequency": "realtime",
  "callback": "soulink.api/soup-feed"
}
```

Now Soulink gets a filtered stream of "Dreams" content from across the soup, surfaced within its own community UX. The creator published on their me3 site, the soup indexed it, Soulink consumed it. Three separate systems, zero platform lock-in.

Any app could do this. A local community app could subscribe to soup content from creators in a geographic area. A study group app could subscribe to content tagged with specific technical topics. The soup becomes a **content bus** that any application can tap into.

---

## Summary of Decisions So Far

| Question | Direction |
|----------|-----------|
| Identity | Layered trust: domain + history + vouch network (Soulink as vouch mechanism). No KYC. |
| Freshness | Tri-directional: sites → soup, soup → sites, soup → PAIs. With crawl fallback. |
| Privacy | Granular creator controls in me.json. Social proof > AI detection for authenticity. |
| Business model | Open source, public good. Funded by me3 ecosystem. |
| Non-me3 content | Phantom profiles from RSS/APIs, clearly marked, claimable. |
| Agent interface | MCP server. PAIs are clients. Sites are HTTP origins. |
| Where humans see content | Everywhere -- the PAI decides. Soup is infrastructure, not a UI. |

---

Want to tighten any of these positions, or shall we start shaping this into a concrete technical plan for a prototype?

---

**User**

Protoype sounds good. let's come up with the best most future proof architecture that we can. Wondering if this 'beads' repo/project might provide any architectural inspiration for this or not. You can check it out here ->  @README.md If it doesn't just ignore it. 

---

**Cursor**

🧙

Let me review the beads project and also understand the current me3 infrastructure better to design the best architecture.

Let me find the beads README the user referenced.

Good. I've now reviewed beads, the full me3 worker architecture, and the complete protocol types. Let me synthesize this into an architecture.

The beads philosophy of "data lives at the source, synced like code, AI-native interface" is philosophically aligned but architecturally different -- beads is a per-repo tool, the soup is a network service. The more relevant architectural inspiration comes from how me3 itself is built: Cloudflare Workers + D1 + R2 + Hono + queues. That's a proven pattern you already know, and it makes the soup trivially deployable alongside me3.

Before I finalize the plan, I have one question:

Fair enough -- I'll make the call. Given the soup is meant to be an open-source public good with its own identity, but we need to prototype fast, I'll design it as **its own repo with a dependency on `me3-protocol`**, structured so it's clean from day one but doesn't over-engineer.

---

**User**

Do you need me to add a folder to this workspace for the separate repo?

---

**Cursor**

🧙

Yes please -- that would be ideal. If you create a `thehumansoup` folder (either alongside the me3-app or added to the workspace), I can scaffold everything into it once you confirm the plan and switch to agent mode.

---

**User**

@README.md Ok let's build. 

---

**Cursor**

🧙

Let me read the current state of the workspace and plan, then start building.

Good, I have the full plan and workspace ready. Let me start building Phase 1 -- the scaffold, schema, indexer, and REST API.

Let me check the me3-protocol source for exact types I need to reference, then scaffold everything.

Good, I have everything I need. Let me now scaffold the entire project. I'll create all the files in parallel batches.

First, the workspace root files:

Now the worker app configuration:

Now the D1 schema and types:

Now the core services -- me3 helpers, indexer, trust, and graph query layer:

Now the REST API routes:

Now the MCP server and the main entry point:

Now the main entry point that wires everything together:

Now let me write the README and install dependencies:

Now let me install dependencies:

Good, dependencies installed. Let me run a typecheck to see if everything compiles:

Just one type issue -- the `as const` on TOOLS is making the tool names too narrow. Let me fix that:

Clean typecheck. Now let me set up the local D1 database and start the dev server:

All 16 SQL commands (6 tables + 10 indexes) executed successfully. Now let's start the dev server and test it:

The sandbox is interfering with wrangler's file watchers. Let me run it without sandbox restrictions:

The dev server is running. Let me test the endpoints:

All three endpoints are working perfectly. Empty soup, ready to be filled. Now let me test the real thing -- register a live me3 site and see if the indexer works:

It crawled a live me3 site and found 1 post. Let me check the soup stats and discover what was indexed:

The soup is alive. Kieran Butler is in the soup with his "Welcome To ME3" post, his newsletter "A.I And Paganism", and his full profile pulled from `me.json`. Let me test the MCP endpoint and the profile endpoint too:

Now let me test an MCP tool call -- let an AI agent "discover" creators:

Everything is working end-to-end. Let me also test the re-index (should detect "unchanged"):

The hash-based change detection works -- it fetched the same `me.json`, saw the hash matched, and skipped re-indexing in 172ms. Let me update the todos and init git:

Let me init the git repo for thehumansoup:

The prototype is built, tested, committed, and pushed. Here's a summary of what's running:

---

**thehumansoup.ai prototype is live locally.** Here's what was built:

**25 files, clean TypeScript, zero lint errors.** The dev server is running on `localhost:55673`.

### What works right now

- **Indexer** crawls live me3 sites, fetches `me.json`, and builds the content graph in D1
- **Change detection** via SHA-256 hash -- re-indexing skips unchanged sites in ~170ms
- **REST API** with full CRUD: discover creators/content, get profiles, personalised feeds, trending, subscription registry, and ingest webhooks
- **MCP Server** with 5 tools (`soup_discover`, `soup_feed`, `soup_profile`, `soup_trending`, `soup_stats`) -- any AI agent that speaks MCP can connect
- **Trust scoring** based on domain ownership, posting history, subscriber count, and verification status
- **Content classifier** ready for Workers AI (keyword-based for now)
- **Cron trigger** configured to re-index all creators every 15 minutes

### Verified with live data

Registered `https://kieran.me3.app` -- the indexer successfully pulled your profile (name, bio, location, avatar, newsletter config) and your "Welcome To ME3" post into the soup.

### What's left for next session

1. **me3-app integration** -- add a `fetch()` call in the me3 worker's publish flow to ping the soup
2. **Deploy to Cloudflare** -- create the D1 database, `wrangler deploy`
3. **Register more me3 sites** to populate the soup
4. **Workers AI classification** -- replace keyword matching with semantic topic extraction
5. **Soulink vouch integration** -- add the human verification layer to trust scoring

---

**User**

ok let's get this up and running. Let's add the ping in @WizardPublish.vue and publish button (in twizzard steps). Let me know how to deploy to cloudflare too. I will work on adding more me3 sites/demos. 

---

**Cursor**

🧙

Let me first read the WizardPublish component and understand how the publish flow works so I can add the soup ping in the right place.

Good, I understand the full publish flow. The best place for the soup ping is in the `usePublish.ts` composable, right after `uploadSite()` succeeds -- fire-and-forget, non-blocking. Let me read the exact files I need to edit.

Now I'll add the soup ping. The right place is right after `uploadSite()` succeeds and `markAsPublished()` -- fire-and-forget so it doesn't block the celebration:

Now I need to remove the duplicate `siteUrl` in the `openSite` block since we moved it earlier, and add the `pingSoup` function:

Now add the `pingSoup` helper function at the top of the file, after the imports:

Let me verify the file looks correct:

Let me typecheck the me3 web app to make sure this is clean:

Clean typecheck. Now let me also add the `VITE_SOUP_API_URL` to the local env file so it points to the local dev server during development:

Good. Now let me give you the Cloudflare deployment instructions. Let me also check your `.env.local` is in `.gitignore` so we don't commit it:

Good, `.env.local` is gitignored. The ping integration is complete. Here's the summary:

---

## What was added to me3-app

**One file changed**: `apps/web/src/composables/usePublish.ts`

- Added `pingSoup()` helper -- fire-and-forget POST to the soup's `/ingest/ping` endpoint
- Called right after `uploadSite()` succeeds and `markAsPublished()`, before the celebration
- 5-second timeout, errors silently swallowed so it never blocks publishing
- Configurable via `VITE_SOUP_API_URL` env var (defaults to `https://api.thehumansoup.ai`)
- Added `VITE_SOUP_API_URL=http://localhost:55673` to `.env.local` for local dev

---

## How to Deploy thehumansoup to Cloudflare

Run these commands from `/Users/kieranbutler/Coding/thehumansoup/apps/worker`:

**Step 1: Create the D1 database**
```bash
cd apps/worker
npx wrangler d1 create soup-db
```
This will output a database ID. Copy it.

**Step 2: Update wrangler.toml with the real database ID**
Replace `TODO-create-d1-database` in `wrangler.toml` with the ID from step 1.

**Step 3: Apply the schema to the remote database**
```bash
pnpm db:migrate:remote
```

**Step 4: Deploy the worker**
```bash
npx wrangler deploy
```

This deploys to `thehumansoup-worker.<your-account>.workers.dev`.

**Step 5 (optional): Add custom domain**
In the Cloudflare dashboard, go to Workers & Pages > thehumansoup-worker > Settings > Triggers > Custom Domains, and add `api.thehumansoup.ai` (after pointing the DNS to Cloudflare).

**Step 6: Update the me3 production env**
Once deployed, set `VITE_SOUP_API_URL` in your me3 production environment to the deployed worker URL (e.g. `https://api.thehumansoup.ai` or `https://thehumansoup-worker.<account>.workers.dev`).

---

The soup dev server is still running on `localhost:55673` if you want to test the full flow locally -- publish a me3 site from the wizard and you should see it appear in the soup.

---

**User**

@thehumansoup-elevator-pitch.md can you update this doc, and fix formatting it will make for a good marketing source later. Add anything non-technical as you see fit to easily explain this non-technically. 

