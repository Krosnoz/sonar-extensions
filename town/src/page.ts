// The page entry: Sonar's page calls start(api) once per page load, with the extension switched on. It places the
// town's icon among the Map's tools, and the town with the phone's icon in the Map's layer (./toggle.ts#wireTown).
// three.js and the town load at the first touch of the icon only, from the parts of the build beside this file.

export { start } from "./start";
