import { expect, test } from "bun:test";
import type { UpstreamResult } from "./checkout";
import { checkout } from "./checkout";

test("retries transient upstream failures", async () => {
  let calls = 0;
  const flaky = async (): Promise<UpstreamResult> => {
    calls++;
    return calls < 3
      ? { ok: false, status: 500 }
      : { ok: true, body: "order-confirmed" };
  };
  const res = await checkout(flaky);
  expect(res.status).toBe(200);
  expect(calls).toBe(3);
});

test("returns 502 after retries exhausted", async () => {
  const alwaysDown = async (): Promise<UpstreamResult> => ({
    ok: false,
    status: 500,
  });
  const res = await checkout(alwaysDown);
  expect(res.status).toBe(502);
});
