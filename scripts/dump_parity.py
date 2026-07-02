import json, sys, tempfile, os
sys.path.insert(0, '/home/mohammed/dev/PortfolioProjects/GoalKeeper/src')
from datetime import date
from goalkeeper.service import Service
from goalkeeper.store.db import SQLiteStore
from goalkeeper.config import UrgencyConfig
from goalkeeper.models import Priority

# IMPORTANT: the Python SQLiteStore opens a NEW connection per call, so ':memory:' would give
# each call a private empty DB. Use a real temp file.
fd, path = tempfile.mkstemp(suffix='.db'); os.close(fd)
try:
    svc = Service(SQLiteStore(path), UrgencyConfig())
    g = svc.add_goal('G', priority=Priority.HIGH)
    p = svc.add_project('P', goal_id=g.id)
    a = svc.add_task('a', project_id=p.id, priority=Priority.MEDIUM, due=date(2026, 5, 30))
    b = svc.add_task('b', depends=[a.id])
    c = svc.add_task('c', tags=['next'])
    now = date(2026, 5, 27)
    out = {
        'tasks': {str(t.seq): t.urgency for t in svc.score(now)},
        'ready': [t.seq for t in svc.ready_tasks(now)],
    }
    print(json.dumps(out, sort_keys=True))
finally:
    os.remove(path)
