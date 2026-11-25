# 0013. A storey being laid shows what is left to lay under a site's net

Status: accepted.

## Context

In the town, a subject's building takes a storey each time its merges double. Between two doublings, each merge lays its share of the storey to come, which stands under the roof ([`architecture.md`](architecture.md)).

That storey was first laid in small scattered cubes: the share laid said how many of them showed, with holes between them and lines in the user's accent. From afar a cube was a pixel or two. A storey stays half laid for days, between two doublings: on 24/11/2026 the maintainer read it, in the dark theme, as a broken display ("broken pixels on the buildings").

Three looks were shown on the running town, from afar and near, by day and by night:

- the wall rises by whole rows, cut clean, the roof set on it;
- the share laid as built, the rest under a building site's net;
- finished storeys only: nothing shows between two doublings.

The maintainer chose the net.

## Decision

- What is laid of the storey shows as the rest of the building.
- What is left to lay is the storey's bare volume under a green net with its mesh, which gets smaller merge after merge. Its green does not follow the user's accent, and a first net, pale, blended with the pale walls. By night it darkens as the town does.
- While the roof goes up over a storey nothing is laid of yet, the net goes up under it: no void under a roof.
- The mesh fades from afar, where it would be finer than a pixel.

## Consequences

- From afar, a storey being laid is one green band: a building with one reads as a site, not as a fault.
- The rule of the heights, the count of the merges and the site's crane, truck and bricks are as before.
- A frame costs the same (7.8 ms before, 7.9 ms after, on the bench's town, 24/11/2026).
