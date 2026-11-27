// Loaded before the test files (../bunfig.toml): a hook set here runs once all of them ran.

import { afterAll } from "bun:test";
import { removeFolders } from "./folders";

// The git the extension starts reads the tests' repositories alone: a rule of the machine's own git settings (an
// address rewritten by `insteadOf`) would change the remote it reads. Git takes "/dev/null" on Windows too.
Object.assign(process.env, { GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" });

afterAll(removeFolders);
