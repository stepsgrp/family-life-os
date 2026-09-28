import pino from "pino";
import { env } from "../env";

export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  redact: ["req.headers.authorization", "*.token", "*.password"],
  transport: env.NODE_ENV === "development" ? { target: "pino-pretty" } : undefined,
});
