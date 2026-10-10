import path from "node:path";

export const examplesPath = path.resolve(
  process.env.ACHIEVE_EXAMPLES_PATH ||
  path.join(import.meta.dirname,"..","achieve_examples")
);

export const mainPort = Number(process.env.ACHIEVE_EXAMPLES_PORT || 8989);
export const secondaryPort = Number(process.env.ACHIEVE_EXAMPLES_SECONDARY_PORT || 8990);
