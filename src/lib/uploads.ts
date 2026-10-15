import path from "path";

// Where pictures are stored on the server. Defaults to an "uploads" folder in the project.
// Set UPLOAD_DIR in .env.local to use another folder (for example D:\fieldguide-uploads).
export const UPLOAD_ROOT = path.resolve(process.env.UPLOAD_DIR ?? "uploads");

export function absPath(rel: string): string {
  const p = path.resolve(UPLOAD_ROOT, rel);
  if (!p.startsWith(UPLOAD_ROOT + path.sep)) throw new Error("Bad file path");
  return p;
}