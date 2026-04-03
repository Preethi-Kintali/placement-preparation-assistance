import mongoose from "mongoose";
import { env } from "./env";

function forceMongoDbName(uri: string, dbName: string): string {
  const input = String(uri ?? "").trim();
  if (!input) return input;

  const schemeSep = input.indexOf("://");
  if (schemeSep < 0) return input;

  const afterScheme = schemeSep + 3;
  const firstSlashAfterHost = input.indexOf("/", afterScheme);
  const queryStart = input.indexOf("?", afterScheme);

  // No path at all (e.g. mongodb://host:27017?x=1) -> insert /db before query
  if (firstSlashAfterHost < 0 || (queryStart >= 0 && firstSlashAfterHost > queryStart)) {
    if (queryStart >= 0) {
      return `${input.slice(0, queryStart)}/${dbName}${input.slice(queryStart)}`;
    }
    return `${input}/${dbName}`;
  }

  const pathStart = firstSlashAfterHost;
  const pathEnd = queryStart >= 0 ? queryStart : input.length;
  const currentPath = input.slice(pathStart + 1, pathEnd); // may be "" or "db"
  const desiredPath = dbName;

  // Empty path (mongodb://host:27017/?x=1) -> fill it
  if (!currentPath) {
    return `${input.slice(0, pathStart + 1)}${desiredPath}${input.slice(pathEnd)}`;
  }

  // Any other db name -> force to requested db
  if (currentPath !== desiredPath) {
    return `${input.slice(0, pathStart + 1)}${desiredPath}${input.slice(pathEnd)}`;
  }

  return input;
}

export async function connectDb(): Promise<void> {
  mongoose.set("strictQuery", true);

  // Enforce a single DB for the whole app (per your request): placeprep
  const mongoUri = forceMongoDbName(env.MONGODB_URI, "placeprep");

  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 10_000,
    maxPoolSize: 10,
    minPoolSize: 2,
    socketTimeoutMS: 30_000,
    connectTimeoutMS: 10_000,
  });

  // eslint-disable-next-line no-console
  console.log(`MongoDB connected (db=${mongoose.connection.name})`);
}
