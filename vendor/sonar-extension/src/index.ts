// The contract between Sonar and the extensions published outside its repository (./contract.ts, what Sonar measures in
// ./measures.ts), and the reading of
// their card (./manifest.ts), and the rules both sides apply (./rules.ts). No dependency: an extension's author may read
// it without the rest of Sonar. Its testing kit is apart, at @sonar/extension/testing (./testing.ts).

export {
	type AgentTool,
	CONTRACT,
	type CoreScreen,
	type Json,
	type Manifest,
	type ManifestKey,
	type PageApi,
	type PageEntry,
	type PageSlots,
	type PageUi,
	type PartPlaces,
	type PartSlot,
	type ProjectLine,
	type ReadFamily,
	type RouteHandler,
	type RouteRequest,
	type ScreenSlot,
	type ServerApi,
	type ServerEntry,
	type ServerEvents,
	type SessionLine,
	type Stop,
} from "./contract";
export {
	type ClosedSession,
	type Covered,
	type LandedMerge,
	type PresenceMinute,
	type ProjectTrust,
	type SessionTimeline,
	type Since,
	type StoppedCommand,
	type TaskLine,
	type TimelineSegment,
	type TrustProof,
	type UsageLine,
	type Velocity,
	type VelocityWeek,
} from "./measures";
export { type ManifestReading, readManifest, type Refusal, RESERVED_IDS } from "./manifest";
export {
	CORE_SCREENS,
	declaredOnly,
	eventRefusal,
	isCoreScreen,
	isPartPlace,
	isReadFamily,
	isSince,
	isToolFullName,
	isToolName,
	LIVE_MOST,
	PART_PLACES,
	READ_FAMILIES,
	routeStatus,
	SERVER_EVENTS,
	TOOL_FULL_NAME_MOST,
	wrongToolField,
} from "./rules";
