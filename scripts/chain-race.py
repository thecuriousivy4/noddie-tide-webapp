"""Prove the activity log survives concurrent writes.

The hash chain is only meaningful if two simultaneous appends cannot both chain off the same
parent. This fires a burst of overlapping requests that each write an audit event, then asks
the register to recompute the whole chain.

Run against a running dev server:

    python scripts/chain-race.py
"""

import json
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor

BASE = "http://localhost:3000"
BURST = 24


def call(method, path, token=None, body=None):
    req = urllib.request.Request(BASE + path, method=method)
    if token:
        req.add_header("Authorization", "Bearer " + token)
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, data, timeout=120) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode())
        except Exception:
            return e.code, {}


def signin(username):
    status, body = call("POST", "/api/auth/signin",
                        body={"username": username, "password": "noddie-" + username})
    assert status == 200, (username, status, body)
    return body["token"]


tokens = {u: signin(u) for u in ["joan", "dana", "minister", "admin"]}

_, before = call("GET", "/api/audit?limit=1", tokens["admin"])
start = before["chain"]["events"]
print("chain has %d events, firing %d overlapping writes" % (start, BURST))


def write(i):
    """Each of these writes at least one audit event from a different code path."""
    if i % 4 == 0:
        return call("POST", "/api/clearance", tokens["dana"],
                    {"cells": ["E4", "F4"] if i % 8 == 0 else ["C6", "D6"]})
    if i % 4 == 1:
        return call("GET", "/api/policy?policy=custodian-records&op=decrypt", tokens["joan"])
    if i % 4 == 2:
        return call("GET", "/api/policy?policy=restricted-women&op=decrypt", tokens["dana"])
    return call("POST", "/api/works-notices", tokens["minister"], {"placeRef": "RB-12"})


with ThreadPoolExecutor(max_workers=BURST) as pool:
    list(pool.map(write, range(BURST)))

_, after = call("GET", "/api/audit?limit=1", tokens["admin"])
chain = after["chain"]
written = chain["events"] - start

print("wrote %d events" % written)
if chain["intact"] and written >= BURST:
    print("PASS  chain intact across %d events after %d concurrent writes"
          % (chain["events"], BURST))
else:
    print("FAIL  %s" % chain)
    raise SystemExit(1)
