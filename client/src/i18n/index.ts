import { core } from "./modules/core";
import { tasks } from "./modules/tasks";
import { flow } from "./modules/flow";
import { admin } from "./modules/admin";
import { comms } from "./modules/comms";

/** All feature modules. Keys must be unique across modules (checked in tests). */
export const MODULES = { core, tasks, flow, admin, comms };

export const de = { ...core.de, ...tasks.de, ...flow.de, ...admin.de, ...comms.de };
export const cs: Record<keyof typeof de, string> = { ...core.cs, ...tasks.cs, ...flow.cs, ...admin.cs, ...comms.cs };

export type TranslationKey = keyof typeof de;
