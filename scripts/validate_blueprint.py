"""Validate source snapshot and mutable atom tracking without third-party dependencies."""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BLUEPRINT = ROOT / "docs/blueprint"
source = json.loads((BLUEPRINT / "atom-coverage-and-dependencies.json").read_text())
tracker = json.loads((ROOT / "docs/backlog/atoms.json").read_text())
text = (BLUEPRINT / "spotify_portal_workflow_architect_micro_atomic_register.md").read_text()
manifest = json.loads((ROOT / "docs/repository-baseline.json").read_text())
for filename, digest in manifest["sourceSnapshotSHA256"].items():
    assert hashlib.sha256((BLUEPRINT / filename).read_bytes()).hexdigest() == digest, filename
assert len(source) == len(tracker) == 516
ids = [a["id"] for a in source]
assert len(set(ids)) == 516
assert sum(a["origin"] != "ADDED" for a in source) == 355
assert re.findall(r"^- \*\*([A-Z]+-\d+)\*\*", text, re.M) == ids
by_id = {a["id"]: a for a in source}
visited, active = set(), set()
def visit(atom_id):
    assert atom_id not in active, f"Dependency cycle: {atom_id}"
    if atom_id in visited:
        return
    active.add(atom_id)
    for dep in by_id[atom_id]["dependsOn"]:
        assert dep in by_id, f"Missing dependency: {dep}"
        visit(dep)
    active.remove(atom_id)
    visited.add(atom_id)
for atom_id in ids:
    visit(atom_id)
assert [a["id"] for a in tracker] == ids
for original, current in zip(source, tracker):
    for key in ("id", "dependsOn", "operation", "passCriterion", "origin"):
        assert original[key] == current[key], (current["id"], key)
    assert current["status"] in {"NOT_STARTED", "IN_PROGRESS", "BLOCKED", "DEFERRED", "DONE"}
    if current["status"] in {"BLOCKED", "DEFERRED"}:
        assert current["reason"], current["id"]
    if current["status"] == "DONE":
        assert current["proof"] and current["reviewer"], current["id"]
print("PASS: immutable snapshot; 516 unique atoms; 355 retained; complete acyclic dependencies; tracker consistent")
