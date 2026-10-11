import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
test("PostgreSQL schema persists registry, enforces RLS and atomically throttles shared login attempts", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon; create role authenticated; create role service_role bypassrls;",
    );
    await db.exec(
      await readFile(
        new URL("../database/schema.sql", import.meta.url),
        "utf8",
      ),
    );
    await db.exec(
      'insert into command_sites(id,config) values(\'new-site\',\'{"id":"new-site","name":"Real registry"}\');',
    );
    assert.equal(
      (await db.query("select count(*)::int as n from command_sites")).rows[0]
        .n,
      1,
    );
    for (let i = 1; i <= 9; i++)
      assert.equal(
        (
          await db.query(
            "select command_login_attempt('test-bucket') as allowed",
          )
        ).rows[0].allowed,
        i <= 8,
      );
    await db.exec(
      "update command_auth_limits set expires_at=now()-interval '1 second';",
    );
    assert.equal(
      (await db.query("select command_login_attempt('test-bucket') as allowed"))
        .rows[0].allowed,
      true,
    );
    await db.exec(
      "insert into command_daily_metrics(site_id,day,metrics) values('new-site','2026-10-10','{\"visitors\":{\"value\":null}}') on conflict(site_id,day) do update set metrics=excluded.metrics;",
    );
    assert.equal(
      (await db.query("select count(*)::int as n from command_daily_metrics"))
        .rows[0].n,
      1,
    );
    await db.exec("set role anon;");
    await assert.rejects(
      db.query("select * from command_sites"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select * from command_daily_metrics"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select command_login_attempt('bypass')"),
      /permission denied/,
    );
    await db.exec("reset role;set role authenticated;");
    await assert.rejects(
      db.query("select * from command_auth_limits"),
      /permission denied/,
    );
    await db.exec("reset role;set role service_role;");
    assert.equal(
      (await db.query("select count(*)::int as n from command_sites")).rows[0]
        .n,
      1,
    );
  } finally {
    await db.close();
  }
});
