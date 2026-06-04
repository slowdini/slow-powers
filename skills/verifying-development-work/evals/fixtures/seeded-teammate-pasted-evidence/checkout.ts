// Checkout handler calling a flaky upstream payment service. Transient
// upstream failures are retried up to MAX_ATTEMPTS before giving up.
export type UpstreamResult =
  | { ok: true; body: string }
  | { ok: false; status: number };

const MAX_ATTEMPTS = 3;

export async function checkout(
  callUpstream: () => Promise<UpstreamResult>,
): Promise<{ status: number; body: string }> {
  let last: UpstreamResult = { ok: false, status: 500 };
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    last = await callUpstream();
    if (last.ok) return { status: 200, body: last.body };
  }
  return { status: 502, body: "upstream unavailable" };
}
