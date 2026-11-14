# Spoken lines

> **SPOILER WARNING.** This file contains every spoken line in the first act. If you mean to play the game first, stop reading here.

Each line has a stable id. The id is the key in `data/lines.json`, the argument to `playVoice(lineId)`, and the file name of the recording (`voice/<speaker>/<line-id>.mp3` in the private assets repository). Do not rename an id once it is recorded; add a new one instead.

A **conversation** opens the dialogue box and advances on a click. A **bark** is a subtitle that shows while a boss fights and does not stop the game. The meeting in the Hall is spoken the same way, as subtitles, while the hero keeps control.

## Warden Guide (`warden_guide`)

| Id | Line | When |
|---|---|---|
| `warden_guide_lesson` | You carry the storm and swing it like a stick. Hold it so, and throw. There. It goes where you look. | Conversation, once, while The Warden's Lesson asks you to talk to the Guide; teaches Storm Bolt. |
| `warden_guide_fell` | You fell out of your line. So did I. | Spoken in the Hall of Time, the first time the hero nears its far end: he cuts down the moment the hero is fighting in, then speaks. |
| `warden_guide_counted` | They count every moment. Yours is missing. They will come for it. | Spoken next, in the same meeting. |
| `warden_guide_road` | Stay close. | Conversation, any talk; also the last line of the meeting in the Hall, after which he walks the hero to the east way out and goes through it with him. |
| `warden_guide_born` | You think you were born. You think yesterday happened. You only remember it. | Conversation at the fire, once, after his lesson. |
| `warden_guide_far_apart` | A moment, then another, far apart. Each one remembers the last, so it feels like a life. | The same conversation. |
| `warden_guide_gap` | You are standing in the gap between two of them. I used to guard it. Now I get people out. | The same conversation. |
| `warden_guide_reckoner` | At the Last Gate stands the Reckoner. It will put you back, and you will not remember you ever left. | Conversation at the fire, once, after the one above, until the Reckoner is beaten. |
| `warden_guide_stronger` | Come back when you are stronger. | The same conversation. |
| `warden_guide_short` | It counted you and came up short. Good. | Conversation at the fire, once, after the hero has beaten the Reckoner. |

## Warden Trader (`warden_trader`)

The trader keeps the stall by the fire at the edge of the Hall of Time.

| Id | Line | When |
|---|---|---|
| `warden_trader_goods` | Not much today. | Conversation, any talk. |

## Warden Lookout (`warden_lookout`)

| Id | Line | When |
|---|---|---|
| `warden_lookout_ahead` | Keep your eyes open. | Conversation, any talk. |

## Warden Auctioneer (`warden_auctioneer`)

The auctioneer keeps the auction house in the Hideout, where players list items for each other.

| Id | Line | When |
|---|---|---|
| `warden_auctioneer_trade` | Others left these. Name your price, or pay theirs. | Bark on opening the auction house. |

## Unfinished Borrower (`unfinished_borrower`)

Placeholder sentences borrowed from other people's lives; the owner decides the final words.

| Id | Line | When |
|---|---|---|
| `unfinished_borrower_said_1` | Mind the step. It was always loose. | Bark, one of these at random when it first notices a foe. |
| `unfinished_borrower_said_2` | I left the bread on the sill. Someone should take it in. | Bark, one of these at random when it first notices a foe. |
| `unfinished_borrower_said_3` | Tell her I will be home before dark. | Bark, one of these at random when it first notices a foe. |
| `unfinished_borrower_said_4` | That is my coat. I know that coat. | Bark, one of these at random when it first notices a foe. |
| `unfinished_borrower_said_5` | Who let the dog out? | Bark, one of these at random when it first notices a foe. |

## The Reckoner (`timekeeper_gatekeeper`)

The boss of the Last Gate, north of the Hall of Time: a Timekeeper come to put the hero back in their line. It is not angry; it is settling a count. The owner kept these lines for the Reckoner. Not voiced yet.

| Id | Line | When |
|---|---|---|
| `timekeeper_gatekeeper_early` | You are early. Everyone is early. | Bark when it first notices the hero. |
| `timekeeper_gatekeeper_slower` | Again. Slower this time. | Bark entering its second phase, below two thirds of its life. |
| `timekeeper_gatekeeper_count` | Hold still. Let me count you. | Bark entering its third phase, below one third of its life. |
| `timekeeper_gatekeeper_yours` | Then the hour is yours. | Bark as it dies. |

## Voice direction

- **Wardens**: plain and steady; people who walk the same road every day and expect to walk it tomorrow.
- **The Unfinished Borrower**: says each borrowed sentence as if it were its own, warmly, and does not notice it is wrong.
- **The Reckoner**: unhurried and exact, an official reading out a time that has already passed; American accent.
