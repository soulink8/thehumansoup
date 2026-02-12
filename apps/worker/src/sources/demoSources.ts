export type SourceType = "video" | "audio" | "article";

export interface DemoSource {
  feedUrl: string;
  type: SourceType;
  name?: string;
  siteUrl?: string;
}

export interface DemoSourceSet {
  displayName: string;
  sources: DemoSource[];
}

export const DEMO_SOURCES: Record<string, DemoSourceSet> = {
  demo: {
    displayName: "Demo",
    sources: [
      // YouTube
      { feedUrl: "https://www.youtube.com/feeds/videos.xml?channel_id=UCFECM-p3CF81Tp_l2sJsiyg", type: "video" },
      { feedUrl: "https://www.youtube.com/feeds/videos.xml?channel_id=UCWyqj7kWQBxrsEFm_Vmsqng", type: "video" },
      { feedUrl: "https://www.youtube.com/feeds/videos.xml?channel_id=UCsVgseBnKuyIGaH54XVoK3Q", type: "video" },
      { feedUrl: "https://www.youtube.com/feeds/videos.xml?channel_id=UCcYzLCs3zrQIBVHYA1sK2sw", type: "video" },
      { feedUrl: "https://www.youtube.com/feeds/videos.xml?channel_id=UC2SuCfuG0-ZUweqX_jDjf9Q", type: "video" },
      { feedUrl: "https://www.youtube.com/feeds/videos.xml?channel_id=UCsBjURrPoezykLs9EqgamOA", type: "video" },
      { feedUrl: "https://www.youtube.com/feeds/videos.xml?channel_id=UCswH8ovgUp5Bdg-0_JTYFNw", type: "video" },
      { feedUrl: "https://www.youtube.com/feeds/videos.xml?channel_id=UC4CbSdwkunwwsNEoEbelOVA", type: "video" },
      { feedUrl: "https://www.youtube.com/feeds/videos.xml?channel_id=UCt1rnzRJzfVfMwjnccCgKFw", type: "video" },
      { feedUrl: "https://www.youtube.com/feeds/videos.xml?channel_id=UC4bTRXU-ycVU516_pZbKG4g", type: "video" },

      // Newsletters / blogs
      { feedUrl: "https://charleseisenstein.substack.com/feed", type: "article" },
      { feedUrl: "https://drbramley.substack.com/feed", type: "article" },
      { feedUrl: "https://newsletter.xavierdagba.com/feed", type: "article" },
      { feedUrl: "https://bernhardguenther.substack.com/feed", type: "article" },
      { feedUrl: "https://sgrstk.substack.com/feed", type: "article" },
      { feedUrl: "https://lauramatsue.substack.com/feed", type: "article" },
      { feedUrl: "https://newsletter.semianalysis.com/feed", type: "article" },
      { feedUrl: "https://chamath.substack.com/feed", type: "article" },
      { feedUrl: "https://newsletter.pragmaticengineer.com/feed", type: "article" },
      { feedUrl: "https://www.lennysnewsletter.com/feed", type: "article" },
      { feedUrl: "https://www.noahpinion.blog/feed", type: "article" },
      { feedUrl: "https://www.operatingbyjohnbrewton.com/feed", type: "article" },

      // Podcasts
      { feedUrl: "https://feeds.megaphone.fm/GLT1412515089", type: "audio" },
      { feedUrl: "https://feeds.fireside.fm/projectorandtheflail/rss", type: "audio" },
      { feedUrl: "https://rss2.flightcast.com/xmsftuzjjykcmqwolaqn6mdn", type: "audio" },
      { feedUrl: "https://feeds.megaphone.fm/thispastweekend", type: "audio" },
      { feedUrl: "https://feeds.megaphone.fm/WWO7410387571", type: "audio" },
      { feedUrl: "https://feeds.megaphone.fm/RSV1597324942", type: "audio" },
      { feedUrl: "https://www.spreaker.com/show/5956723/episodes/feed", type: "audio" },
      { feedUrl: "https://feeds.simplecast.com/UCwaTX1J", type: "audio" },
    ],
  },
};
