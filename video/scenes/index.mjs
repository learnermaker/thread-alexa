// Scene registry: id -> recorder function (order is the order in the final cut).
import { recordSim } from "./sim.mjs";
import { recordHook, recordBoot, recordInspector, recordAuth, recordCode, recordArch, recordCdk, recordHonest, recordClose } from "./static.mjs";

export const recorders = {
  hook: recordHook, boot: recordBoot, sim: recordSim, inspector: recordInspector,
  auth: recordAuth, code: recordCode, arch: recordArch, cdk: recordCdk, honest: recordHonest, close: recordClose,
};
