import { fileURLToPath } from "node:url";

export const applicationPath = fileURLToPath(new URL("./application/",import.meta.url));
export const mainPort = Number(process.env.ACHIEVE_EXAMPLES_PORT || 8989);
export const secondaryPort = Number(process.env.ACHIEVE_EXAMPLES_SECONDARY_PORT || 8990);
