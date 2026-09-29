import { env } from "cloudflare:workers";
export function database() {
  if (!env.DB) throw new Error("STORAGE_UNAVAILABLE");
  return env.DB;
}
export type Row = {
  id: string;
  kind: string;
  data: string;
  revision: number;
  event: string;
  updated: number;
};
export function unpack(row: Row) {
  return {
    id: row.id,
    kind: row.kind,
    data: JSON.parse(row.data),
    revision: row.revision,
    updated: row.updated,
  };
}
