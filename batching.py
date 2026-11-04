"""Batch planning for the daily screening report.

Pure functions only: no network, no Asana, no file I/O. The delivery path in
screen.py is NOT wired to this module yet; it is the reviewed foundation for
per-batch delivery. Every batch carries its own dedup key so a re-run cannot
post the same batch twice (the 17 Sep duplicate-posting incident this guards
against), and no subject is dropped or duplicated when a run is split.
"""

DEFAULT_BATCH_SIZE = 20


def plan_batches(subjects, size=DEFAULT_BATCH_SIZE):
    """Split subjects into consecutive batches of at most `size`, order kept."""
    if isinstance(size, bool) or not isinstance(size, int) or size < 1:
        raise ValueError("batch size must be a positive integer")
    items = list(subjects)
    return [items[i:i + size] for i in range(0, len(items), size)]


def batch_dedup_key(mode, run_date, batch_no, batch_total):
    """Stable key for one batch of one run: mode + calendar date + position."""
    if not (isinstance(batch_no, int) and isinstance(batch_total, int)):
        raise ValueError("batch numbers must be integers")
    if not (1 <= batch_no <= batch_total):
        raise ValueError("batch_no must be between 1 and batch_total")
    return f"{mode}|{run_date}|batch {batch_no}/{batch_total}"


def batch_title(run_label, run_date, batch_no, batch_total):
    """Human-readable title for one batch's delivery task."""
    return (f"Daily screening {run_date} ({run_label}) — "
            f"batch {batch_no} of {batch_total}")
