"""Reset the register to the two-minute demo's opening position.

Run this before each run-through (the dev server must be up):

    python scripts/demo-stage.py

It clears every change request, the audit log and the clearance log, puts the four
places back to QUIET, strips any permit role left on Dana's account, and then has
Dana lodge a works notice against RB-07 and serve it. You are left at:

    CR-2026-0001 - WORKS_PERMIT - PENDING_QUORUM, 0 of 2 approvals

which is where the demo starts. Nothing here touches the accounts or the sealed
places, so no reseed is needed.

Use --clean to stop after the wipe, without lodging anything (the seven-step
walkthrough in the README starts there instead).
"""
import json
import subprocess
import sys
import urllib.error
import urllib.request

BASE = "http://localhost:3000"
CONTAINER = "noddie-postgres"

WIPE = [
    "delete from change_request;",
    "delete from audit_event;",
    "delete from clearance_check;",
    "update place set status='QUIET';",
    # A committed permit from an earlier run leaves permit-rb07 on Dana's account.
    "update user_ref set \"devRoles\" = array['proponent'] where username = 'dana';",
]


def psql(sql):
    out = subprocess.run(
        ["docker", "exec", CONTAINER, "psql", "-U", "noddie", "-d", "noddie", "-tAc", sql],
        capture_output=True, text=True,
    )
    if out.returncode != 0:
        sys.exit("psql failed: %s" % (out.stderr.strip() or out.stdout.strip()))
    return out.stdout.strip()


def call(method, path, token=None, body=None):
    req = urllib.request.Request(BASE + path, method=method)
    if token:
        req.add_header("Authorization", "Bearer " + token)
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, data, timeout=60) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode())
        except Exception:
            return e.code, {}
    except urllib.error.URLError as e:
        sys.exit("Cannot reach %s - is `npm run dev` running? (%s)" % (BASE, e.reason))


def main():
    clean_only = "--clean" in sys.argv

    for sql in WIPE:
        psql(sql)
    print("wiped: requests, audit log, clearance log; places back to QUIET; Dana reset")

    if clean_only:
        print("\nClean. Start at step 1 of the README walkthrough.")
        return

    status, body = call("POST", "/api/auth/signin",
                        body={"username": "dana", "password": "noddie-dana"})
    if status != 200:
        sys.exit("Dana could not sign in (%s): %s" % (status, body))
    dana = body["token"]

    status, created = call("POST", "/api/changes", dana, {
        "placeId": "RB-07",
        "type": "WORKS_PERMIT",
        "title": "Haul road crossing the Blue Zone",
        "description": "a 1.8km haul road crossing the Blue Zone and its northern approaches",
    })
    if status != 201:
        sys.exit("Could not lodge the request (%s): %s" % (status, created))

    cid = created["id"]
    status, notice = call("POST", "/api/changes/%s/notice" % cid, dana)
    if status != 200:
        sys.exit("Could not serve the notice (%s): %s" % (status, notice))

    community = created["community"]
    print("\nStaged and ready:")
    print("  %s  -  %s" % (created["ref"], "PENDING_QUORUM"))
    print("  routed to %s" % community["name"])
    print("  rule: %s" % community["consentRule"])
    print("  needs %d of %d custodians" % (community["quorumThreshold"],
                                           community["custodianCount"]))
    print("  notice SHA-256: %s" % notice["sha256"])
    print("\n  open at %s/requests/%s" % (BASE, cid))
    print("\nStart the demo as the minister.")


if __name__ == "__main__":
    main()
