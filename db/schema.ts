import {
  sqliteTable,
  text,
  integer,
  primaryKey,
} from "drizzle-orm/sqlite-core";
export const records = sqliteTable(
  "study_records",
  {
    owner: text("owner").notNull(),
    id: text("id").notNull(),
    kind: text("kind").notNull(),
    data: text("data").notNull(),
    revision: integer("revision").notNull().default(1),
    event: text("event").notNull(),
    updated: integer("updated").notNull(),
  },
  (t) => [primaryKey({ columns: [t.owner, t.id] })],
);
