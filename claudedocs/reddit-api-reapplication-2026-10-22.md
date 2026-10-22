# Reddit Data API 再申請 下書き（2026-10-22）

**状態: 2026-10-22 にユーザーが送信済み（時刻・問い合わせ番号は確認メール待ち、末尾に追記する）。** 送信はユーザーが `support.reddithelp.com` の Data Access Request から行う。
送信したら、下の「提出した全文」節に**送った文面をそのまま**貼り直し、日時と問い合わせ番号も残すこと
（前回 2026-07 の申請は文面を残しておらず、却下理由の検証ができなかった）。

## 送信前にユーザーが確かめること（私は確認できない）

1. **収益**: 広告・アフィリエイト・有料機能が本当にゼロか。1つでもあれば「非商用」と書けない。
2. **LLM の送り先**: 現行は GLM（智譜AI）の API に投稿本文を送って要約している。次のどちらで書くか決める。
   - A. 現行のまま書く（GLM に本文を送る。GLM 側が学習に使わない保証は未確認 → 「使わない」とは書かない）
   - B. 要約はバッチ処理を止め、手元で人が確認しながら行うと書く（現在の手動運用の実態に合う）
3. **Reddit アカウント名と連絡先メール**: 下の `[...]` を埋める。
4. 公開URL: `https://chillmeru.netlify.app/`

## 提出文案（英語）

**Subject:** Data Access Request — read-only, non-commercial reader for r/medlabprofessionals (Chillmeru)

**Who I am / what the project is**
I am an individual developer in Japan. Chillmeru (https://chillmeru.netlify.app/) is a free, non-commercial,
read-only website that helps Japanese-speaking clinical laboratory professionals read what their peers abroad
say about working in the lab (workload, pay, certification such as ASCP, workplace culture). Reddit's
r/medlabprofessionals is the main source of such discussion in English. Reddit username: [u/...]. Contact: [email].

**Why Reddit data**
There is no comparable public place where practicing lab professionals discuss their work candidly.
My readers cannot read these discussions in English, so the site gives each post a short Japanese summary
and a link to the original thread. The goal is to send readers to Reddit, not to replace it.

**Exactly what I read, and how much**
- Subreddit: r/medlabprofessionals only (occasionally r/medlabtechs, r/MLS_CLS, r/MedLabInCanada).
- Endpoint: listing of top posts of the past week (read-only; no write, vote, comment, message or moderation actions).
- Volume: one run per day, at most 25 posts per request (about 1 request/day, far below any rate limit).
- OAuth, with a descriptive User-Agent in the documented format: `web:chillmeru:v0.1 (by /u/[...])`.
- I will watch the X-Ratelimit-* response headers and stay far below the 100 QPM free-tier limit.

**What I store and show**
- I do NOT store or display the original post body or comments. The data model has no field for them.
- I store only: post ID, permalink, score, comment count, creation time, and my own Japanese summary
  (2-3 sentences, paraphrased) with a topic label.
- I do not store or show Reddit usernames.
- Every card links back to the original Reddit thread.
- Deletions: at least every 48 hours I re-check the stored post IDs against Reddit. If a post or its author's
  account has been deleted or removed, I delete its summary and all related fields. I do not keep
  deleted content in anonymized form. [CONFIRM: git history of the public repo still holds old summaries —
  decide how to handle (history rewrite, or keep the stored set small enough to purge) before claiming this]

**What I do NOT do**
- No training, fine-tuning or evaluation of machine-learning models on Reddit content.
- No resale, sublicensing, bulk redistribution, or datasets.
- No advertising, affiliate links, paywalls or other revenue on the site. [CONFIRM before sending]
- No monitoring or profiling of individual users.
- No attempt to circumvent Reddit's access controls; before applying I stopped unauthenticated scraping
  after it was blocked and I am asking for sanctioned access instead.

**Summarization** [choose A or B — see notes above]
- A: Post text is passed transiently to a hosted LLM API only to produce the short summary; the output is
  my paraphrase, the input is not retained by my system. [state provider and its data-use terms only if verified]
- B: Summaries are written with a human in the loop on a small number of selected posts per week.

**Architecture** (static site, no server): a scheduled GitHub Actions job fetches the listing, drops posts
already seen, writes summaries to a JSON file in a public repository, and the static page renders that JSON.
No user accounts, no user data collected on the site.

**Why not Devvit**
I looked at Devvit first. Chillmeru is an external static website for Japanese readers, not an app that runs inside
Reddit, and Devvit's data access is aimed at in-Reddit apps and moderation use. It cannot feed a site outside Reddit,
so I am using this form as the page asks for apps Devvit does not support. [CONFIRM this matches what you found]

**Request**
Read-only OAuth access to public listings for the subreddits above, for non-commercial use as described.
I am happy to adjust scope, rate, or attribution to meet the Responsible Builder Policy.

## フォーム欄ごとの回答（2026-10-22 版・フォームの実際の項目に合わせた）

フォーム: https://support.reddithelp.com/hc/en-us/requests/new?ticket_form_id=14868593862164
選択: Data Access Request / role = I'm a developer / inquiry = "…does not work in the Devvit ecosystem"
Reddit username: Total_Nectarine_7751（User-Agent: `web:chillmeru:v0.1 (by /u/Total_Nectarine_7751)`）

### 欄1: benefit/purpose ＋ 詳細な説明と例
Chillmeru (https://chillmeru.netlify.app/) is a free, non-commercial, read-only website for Japanese-speaking clinical laboratory professionals. Lab staff in Japan have almost no way to read how their peers abroad talk about the job (workload, pay, ASCP certification, workplace culture). r/medlabprofessionals is where this is discussed most candidly, but it is in English.

For each selected post the site shows a short Japanese paraphrase (2-3 sentences), a topic label, and a link to the original Reddit thread. The goal is to send Japanese readers to the thread, not to replace it.

What the app does on Reddit (read-only): about once a day it requests the list of top posts of the past week from r/medlabprofessionals, at most 25 posts per request. It never posts, comments, votes, sends messages or moderates.

What I store: post ID, permalink, score, comment count, creation time, my own Japanese paraphrase and a topic label. I do not store or show post bodies, comments or usernames.

Illustrative example: a thread where a technologist describes covering a night shift alone becomes one card with a short Japanese title, a 2-sentence paraphrase, and a button to the original thread.

Deletions: I re-check stored post IDs at least every 48 hours; if a post or its author's account is deleted or removed, I delete its summary and all related fields. [CONFIRM: git history — see note above]

Not done: no machine-learning training on Reddit content, no resale or datasets, no ads/affiliate/paywall [CONFIRM], no user profiling. I stopped unauthenticated scraping after it was blocked and am asking for sanctioned access instead.

Summarization: [A または B を選んで1〜2文。上の「送信前に確かめること」参照]

### 欄2: What is missing from Devvit?
Devvit apps run inside Reddit and have no way to deliver data to a website outside Reddit. Chillmeru is a standalone static site for readers who mostly do not use Reddit and cannot read English. The data I need is public post listings of a subreddit I do not moderate, while Devvit's data access, as far as I could find, is meant for apps installed by a subreddit's moderators. [CONFIRM: Devvit の説明ページ（黄色い枠の here）と食い違っていないか確認]

### 欄3: source code / platform link
https://github.com/matdonaruno/Chillmeru (public) — site: https://chillmeru.netlify.app/
※ 現行コード `lib/reddit.mjs` は OAuth ではなく認証なしの公開JSONを叩く作り（User-Agent のみ送信、偽装なし）。承認後に OAuth へ書き換える必要がある。

### 欄4: subreddits
r/medlabprofessionals (main). Occasionally r/medlabtechs, r/MLS_CLS, r/MedLabInCanada.

### 欄5: username
Total_Nectarine_7751

## 提出した全文（送信後にここへ貼る）

**状態: 送信前の入力内容（2026-10-22、ユーザーがフォーム画面から貼付）。送信日時・問い合わせ番号は未記入 → 送信後に追記する。**

- Form: Data Access Request / Email: neoae101@hotmail.com
- Role: I'm a developer / Inquiry: I'm a developer and want to build a Reddit App that does not work in the Devvit ecosystem.
- Reddit account name: Total_Nectarine_7751
- Attachments: なし

**What benefit/purpose will the bot/app have for Redditors?**
Chillmeru (https://chillmeru.netlify.app/) is a free, non-commercial, read-only website for Japanese-speaking clinical laboratory professionals. Lab staff in Japan have almost no way to read how their peers abroad talk about the job (workload, pay, ASCP certification, workplace culture). r/medlabprofessionals is where this is discussed most candidly, but it is in English.

For each selected post, the site shows a short Japanese paraphrase (2-3 sentences), a topic label, and a link to the original Reddit thread. The goal is to send Japanese readers to the thread, not to replace it.

**Provide a detailed description of what the Bot/App will be doing on the Reddit platform.**
What the app does on Reddit (read-only): about once a day it requests the list of top posts of the past week from r/medlabprofessionals, at most 25 posts per request. It never posts, comments, votes, sends messages, or moderates. It will use OAuth and the documented User-Agent format: web:chillmeru:v0.1 (by /u/Total_Nectarine_7751), and will respect the X-Ratelimit headers.

What I store: post ID, permalink, score, comment count, creation time, my own Japanese paraphrase, and a topic label. I do not store or show post bodies, comments, or usernames.

Illustrative example: a thread where a technologist describes covering a night shift alone becomes one card with a short Japanese title, a 2-sentence paraphrase, and a button to the original thread.

Deletions: once access is granted, I will re-check the stored post IDs at least every 48 hours. If a post or its author's account has been deleted or removed, I will remove its summary and all related fields from the published data.

Summaries: they are drafted with an LLM assistant in an interactive session and reviewed by me before publishing, for a small number of posts per week. There is no bulk pipeline, and I do not keep the post text.

What I do not do: no training or fine-tuning of machine-learning models on Reddit content, no resale or datasets, no ads, affiliate links, or paywall, and no profiling of individual users. Earlier I fetched public listings without authentication; that was blocked, so I stopped and am asking for sanctioned access instead.

**What is missing from Devvit that prevents building on that platform?**
Devvit apps run inside Reddit and have no way to deliver data to a website outside Reddit. Chillmeru is a standalone static site for readers who mostly do not use Reddit and cannot read English. The data I need is public post listings of a subreddit I do not moderate, while Devvit's data access, as far as I could find, is meant for apps installed by a subreddit's moderators.

**Provide a link to source code or platform that will access the API.**
https://github.com/matdonaruno/Chillmeru (public repository) , https://chillmeru.netlify.app/

**What subreddits do you intend to use the bot/app in?**
r/medlabprofessionals (main). Occasionally r/medlabtechs, r/MLS_CLS, r/MedLabInCanada.

**Username (optional):** Total_Nectarine_7751

**送信日時:** 2026-10-22（ユーザー報告。時刻は未記入）
**問い合わせ番号:** （未記入）
