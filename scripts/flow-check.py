"""End-to-end check of the Noddie governance flow, over the real HTTP API.

Run against a running dev server and a freshly seeded database:

    npm run db:reset && npm run db:seed
    npm run dev
    npm run verify

It asserts pre-commit states (the gate refusing before a quorum exists), so a database that
has already been through a run will report those checks as failures. Reseed first.
"""
import json
import urllib.request
import urllib.error

BASE = "http://localhost:3000"
results = []


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
            raw = r.read()
            ct = r.headers.get("Content-Type", "")
            if "json" in ct:
                return r.status, json.loads(raw.decode())
            return r.status, {"_bytes": len(raw), "_hash": r.headers.get("X-Document-SHA256"),
                              "_recomputed": r.headers.get("X-Document-SHA256-Recomputed")}
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw.decode())
        except Exception:
            return e.code, {"raw": raw[:200].decode(errors="replace")}


def login(username):
    """Sign in through the simulated identity provider, with a real credential post."""
    status, body = call("POST", "/api/auth/signin",
                        body={"username": username, "password": "noddie-" + username})
    assert status == 200, (username, status, body)
    return body["token"]


def check(label, ok, detail=""):
    results.append((ok, label, detail))
    print(("PASS  " if ok else "FAIL  ") + label + ((" :: " + str(detail)) if detail else ""))


# --- tokens -----------------------------------------------------------------
tokens = {u: login(u) for u in ["joan", "ray", "lena", "dana", "minister", "admin"]}
check("the identity provider issues a token per account on correct credentials", all(tokens.values()))

s, bad = call("POST", "/api/auth/signin", body={"username": "dana", "password": "wrong"})
check("a wrong password is refused", s == 401, bad.get("error", {}).get("code"))

s, nouser = call("POST", "/api/auth/signin", body={"username": "nobody", "password": "noddie-nobody"})
check("an unknown username is refused with the same message", s == 401,
      nouser.get("error", {}).get("message") == bad.get("error", {}).get("message"))

s, me = call("GET", "/api/me", tokens["dana"])
check("token roles are read server-side", s == 200 and me["user"]["roles"] == ["proponent"], me.get("user"))

# --- 1. a proponent cannot read protected fields ----------------------------
s, body = call("GET", "/api/policy?policy=custodian-records&op=decrypt", tokens["dana"])
check("proponent is refused the custodian-records policy", s == 403, body.get("error", {}).get("code"))

s, body = call("GET", "/api/policy?policy=custodian-records&op=decrypt", tokens["admin"])
check("plain platform admin is refused it too", s == 403, body.get("error", {}).get("code"))

s, body = call("GET", "/api/policy?policy=custodian-records&op=decrypt", tokens["joan"])
check("a custodian is allowed it", s == 200 and "key" in body)

s, body = call("GET", "/api/policy?policy=restricted-women&op=decrypt", tokens["ray"])
check("custodian without the women standing is refused the restricted layer", s == 403)

s, body = call("GET", "/api/policy?policy=restricted-women&op=decrypt", tokens["lena"])
check("Lena, who holds that standing, is allowed it", s == 200 and "key" in body)

# --- 2. the register is ciphertext ------------------------------------------
s, body = call("GET", "/api/places", tokens["admin"])
places = body["places"]
sealed_ok = all(p["sealed"]["name"].startswith("dev1:") for p in places)
check("every protected column is ciphertext (%d places)" % len(places), s == 200 and sealed_ok)

# --- 3. clearance check -----------------------------------------------------
s, body = call("POST", "/api/clearance", tokens["dana"], {"cells": ["E4", "E5", "F4", "F5"]})
hits = body.get("hits", [])
check("clearance check returns public info only", s == 200 and len(hits) == 1 and
      "sealed" not in json.dumps(hits), [h["publicRef"] for h in hits])

s, body = call("POST", "/api/clearance", tokens["joan"], {"cells": ["ZZ"]})
check("invalid zones are rejected", s == 400)

# --- 4. initiate ------------------------------------------------------------
s, cr = call("POST", "/api/changes", tokens["dana"], {
    "placeId": "RB-07", "type": "WORKS_PERMIT",
    "title": "Haul-road corridor across RB-07",
    "description": "A 1.8 km haul road crossing the northern zones, with culvert works.",
})
check("proponent can open a change request", s == 201 and cr.get("state") == "DRAFT", cr.get("ref"))
cid = cr["id"]
cref = cr["ref"]

s, body = call("POST", "/api/changes", tokens["dana"], {
    "placeId": "RB-07", "type": "WORKS_PERMIT", "title": "again", "description": "duplicate",
})
check("a second open request for the same place+role is refused", s == 409, body.get("error", {}).get("code"))

# --- 5. no decisions before a notice ---------------------------------------
s, body = call("POST", "/api/changes/%s/decision" % cid, tokens["joan"], {"decision": "APPROVE"})
check("no custodian can decide before the notice is served", s == 409, body.get("error", {}).get("message"))

# --- 6. issue the notice ----------------------------------------------------
s, notice = call("POST", "/api/changes/%s/notice" % cid, tokens["dana"])
check("notice is issued and hashed", s == 200 and len(notice.get("sha256", "")) == 64,
      notice.get("sha256", "")[:16])
check("state advances to PENDING_QUORUM", notice.get("state") == "PENDING_QUORUM", notice.get("state"))
docid = notice.get("documentId")

s, pdf = call("GET", "/api/changes/%s/documents/%s" % (cid, docid), tokens["dana"])
check("the notice PDF downloads and re-hashes to the logged value",
      s == 200 and pdf["_hash"] == pdf["_recomputed"] == notice["sha256"], pdf.get("_bytes"))

# --- 7. the gate, before any permit exists ---------------------------------
s, body = call("POST", "/api/works-notices", tokens["dana"], {"placeRef": "RB-07"})
check("works notice is REFUSED while the token carries no permit role", s == 403,
      body.get("error", {}).get("requiredRole"))

s, body = call("POST", "/api/works-notices", tokens["admin"], {"placeRef": "RB-07"})
check("a platform admin is refused the same gate", s == 403)

# --- 8. the minister presses consent ---------------------------------------
s, before = call("GET", "/api/changes/%s" % cid, tokens["minister"])
s, consent = call("POST", "/api/changes/%s/minister-consent" % cid, tokens["minister"])
s2, after = call("GET", "/api/changes/%s" % cid, tokens["minister"])
check("minister consent returns 200 and is recorded", s == 200 and consent.get("effect") == "none")
check("minister consent does not change the state",
      after["request"]["state"] == before["request"]["state"] == "PENDING_QUORUM")
check("minister consent is not counted in the tally",
      after["tally"]["approvals"] == before["tally"]["approvals"] == 0)
check("minister cannot approve", call("POST", "/api/changes/%s/decision" % cid,
                                      tokens["minister"], {"decision": "APPROVE"})[0] == 403)
check("minister cannot commit", call("POST", "/api/changes/%s/commit" % cid, tokens["minister"])[0] == 403)
check("admin cannot commit", call("POST", "/api/changes/%s/commit" % cid, tokens["admin"])[0] == 403)

# --- 9. the quorum ----------------------------------------------------------
s, d1 = call("POST", "/api/changes/%s/decision" % cid, tokens["joan"], {"decision": "APPROVE"})
check("first custodian approval recorded", s == 200 and d1["tally"]["approvals"] == 1, d1["state"])
check("one approval is not enough", d1["state"] == "PENDING_QUORUM" and
      d1["tally"]["outstanding"] == 1)

s, body = call("POST", "/api/changes/%s/decision" % cid, tokens["joan"], {"decision": "APPROVE"})
check("the same custodian cannot approve twice", s == 409, body.get("error", {}).get("code"))

s, body = call("POST", "/api/changes/%s/commit" % cid, tokens["joan"])
check("cannot commit before the threshold is met", s == 409, body.get("error", {}).get("message"))

s, d2 = call("POST", "/api/changes/%s/decision" % cid, tokens["ray"], {"decision": "APPROVE"})
check("second custodian approval reaches the threshold",
      s == 200 and d2["state"] == "APPROVED" and d2["tally"]["approvals"] == 2, d2["state"])

# --- 10. commit -------------------------------------------------------------
s, committed = call("POST", "/api/changes/%s/commit" % cid, tokens["lena"])
check("a custodian commits the approved request", s == 200 and committed["state"] == "COMMITTED",
      committed.get("grantedRole"))
proofs = committed["proofs"]
check("proof of notice present", proofs["notice"]["present"] and len(proofs["notice"]["sha256"]) == 64)
check("proof of consent present with 2 signatures", proofs["consent"]["present"] and
      len(proofs["consent"]["signatures"]) == 2)
check("proof of authority present", proofs["authority"]["present"])
check("minister consent recorded but marked not counted",
      proofs["ministerConsent"]["recorded"] and proofs["ministerConsent"]["counted"] is False)

s, detail = call("GET", "/api/changes/%s" % cid, tokens["joan"])
kinds = sorted(d["kind"] for d in detail["documents"])
check("the instrument of consent was issued", "PERMIT_INSTRUMENT" in kinds, kinds)

# --- 11. the gate, after the commit ----------------------------------------
s, body = call("POST", "/api/works-notices", tokens["dana"], {"placeRef": "RB-07"})
check("Dana's OLD token still cannot lodge (the permit is in the token, not the database)",
      s == 403, body.get("error", {}).get("code"))

fresh = login("dana")
s, me2 = call("GET", "/api/me", fresh)
check("after a token refresh the permit role is in the token",
      "permit-rb07" in me2["user"]["roles"], me2["user"]["roles"])

s, accepted = call("POST", "/api/works-notices", fresh, {"placeRef": "RB-07"})
check("works notice is ACCEPTED on the refreshed token", s == 200 and
      accepted["outcome"] == "accepted", accepted.get("receipt", {}).get("sha256", "")[:16])

s, body = call("POST", "/api/works-notices", fresh, {"placeRef": "RB-12"})
check("the permit is scoped to one place (RB-12 still refused)", s == 403,
      body.get("error", {}).get("requiredRole"))

# --- 12. four eyes ----------------------------------------------------------
s, cr2 = call("POST", "/api/changes", tokens["joan"], {
    "placeId": "RB-12", "type": "WORKS_PERMIT", "title": "Test of four-eyes",
    "description": "A custodian lodges a request and then tries to approve it.",
    "subjectSub": "u-dana", "subjectName": "Dana Price",
})
cid2 = cr2["id"]
call("POST", "/api/changes/%s/notice" % cid2, tokens["joan"])
s, body = call("POST", "/api/changes/%s/decision" % cid2, tokens["joan"], {"decision": "APPROVE"})
check("the initiator cannot approve their own request", s == 403, body.get("error", {}).get("code"))

# --- 13. refusal path -------------------------------------------------------
call("POST", "/api/changes/%s/decision" % cid2, tokens["ray"], {"decision": "DENY"})
s, denied = call("POST", "/api/changes/%s/decision" % cid2, tokens["lena"],
                 {"decision": "DENY", "reason": "Too close to the spring flat."})
check("two denials make the threshold unreachable and refuse the request",
      denied["state"] == "REJECTED", denied["state"])
s, det2 = call("GET", "/api/changes/%s" % cid2, tokens["joan"])
check("a refusal notice is issued for a refused request",
      any(d["kind"] == "REFUSAL_NOTICE" for d in det2["documents"]),
      [d["kind"] for d in det2["documents"]])

# --- 13b. a second corporation, with its own rule --------------------------
s, body = call("GET", "/api/places", tokens["joan"])
orgs = {o["id"]: o for o in body["orgs"]}
check("the register holds more than one corporation", len(orgs) >= 2, list(orgs))
check("each corporation carries its own threshold",
      orgs.get("stony-pass-ac", {}).get("quorumThreshold") == 3
      and orgs.get("wattle-creek-toc", {}).get("quorumThreshold") == 2,
      {k: v.get("quorumThreshold") for k, v in orgs.items()})

sp = next((p for p in body["places"] if p["publicRef"] == "SP-04"), None)
check("a place is held by its own corporation", sp is not None
      and sp["custodianOrg"]["id"] == "stony-pass-ac")

s, cr3 = call("POST", "/api/changes", tokens["dana"], {
    "placeId": "SP-04", "type": "WORKS_PERMIT",
    "title": "Access track across SP-04",
    "description": "A short access track crossing the saddle, with a culvert at the low point.",
})
cid3 = cr3["id"]
call("POST", "/api/changes/%s/notice" % cid3, tokens["dana"])
s, d = call("GET", "/api/changes/%s" % cid3, tokens["joan"])
check("the request inherits the holding corporation's threshold, not a global one",
      d["tally"]["threshold"] == 3, d["tally"])
call("POST", "/api/changes/%s/decision" % cid3, tokens["joan"], {"decision": "APPROVE"})
s, two = call("POST", "/api/changes/%s/decision" % cid3, tokens["ray"], {"decision": "APPROVE"})
check("two approvals do NOT carry a place whose community requires three",
      two["state"] == "PENDING_QUORUM" and two["tally"]["outstanding"] == 1, two["state"])
s, three = call("POST", "/api/changes/%s/decision" % cid3, tokens["lena"], {"decision": "APPROVE"})
check("the third approval carries it", three["state"] == "APPROVED", three["state"])

# --- 14. transparency and the audit chain ----------------------------------
s, t = call("GET", "/api/transparency", tokens["admin"])
check("transparency: every claim holds, read as the administrator",
      s == 200 and all(c["holds"] for c in t["claims"]),
      [(c["claim"], c["holds"]) for c in t["claims"] if not c["holds"]])
check("transparency: audit chain intact", t["auditChain"]["intact"], t["auditChain"])

s, a = call("GET", "/api/audit?limit=400", tokens["admin"])
check("audit log is chained and intact (%d events)" % a["chain"]["events"], a["chain"]["intact"])
actions = {e["action"] for e in a["events"]}
for needed in ["change.initiated", "change.notice_issued", "change.pending_quorum",
               "change.approved_by", "change.quorum_reached", "change.committed",
               "change.minister_consent_recorded", "works_notice.refused",
               "works_notice.accepted", "policy.refused", "clearance.checked",
               "change.rejected", "document.issued"]:
    check("audit records " + needed, needed in actions)

# --- 15. unauthenticated access --------------------------------------------
check("no token is 401 on the register", call("GET", "/api/places")[0] == 401)
check("a tampered token is 401", call("GET", "/api/places", tokens["joan"][:-3] + "AAA")[0] == 401)

print()
failed = [r for r in results if not r[0]]
print("%d checks, %d failed" % (len(results), len(failed)))
for _, label, detail in failed:
    print("  FAILED: " + label + " :: " + str(detail))
