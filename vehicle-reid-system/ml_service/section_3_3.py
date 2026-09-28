import os

_HERE = os.path.dirname(os.path.abspath(__file__))
_DEFAULT_REGION = os.environ.get("PLATE_REGION", "US").upper()
_VALID_REGIONS = {"NL", "US"}

# Import both backends. Both modules define their own ROOT, jobs,
# jobs_lock, launch_job, disk_error, MAX_UPLOAD_BYTES, RESULTS_DIR.
try:
    import section_3_3_us as _us
except Exception as _e:
    print(f"[section_3_3] US backend failed to import: {_e}")
    _us = None

try:
    import section_3_3_nl as _nl
except Exception as _e:
    print(f"[section_3_3] NL backend failed to import: {_e}")
    _nl = None


def _pick(region):
    region = (region or _DEFAULT_REGION).upper()
    if region not in _VALID_REGIONS:
        region = _DEFAULT_REGION
    return region, (_nl if region == "NL" else _us)

if _us is not None:
    ROOT = _us.ROOT
    RESULTS_DIR = _us.RESULTS_DIR
    MAX_UPLOAD_BYTES = _us.MAX_UPLOAD_BYTES
    jobs = _us.jobs
    jobs_lock = _us.jobs_lock
    disk_error = _us.disk_error
elif _nl is not None:
    ROOT = _nl.ROOT
    RESULTS_DIR = _nl.RESULTS_DIR
    MAX_UPLOAD_BYTES = _nl.MAX_UPLOAD_BYTES
    jobs = _nl.jobs
    jobs_lock = _nl.jobs_lock
    disk_error = _nl.disk_error
else:
    raise RuntimeError("Neither plate-tracking backend could be imported.")


def launch_job(in_path, delete_input=True, region=None, camera_id=None):
    """Route to the correct backend based on region."""
    region, backend = _pick(region)
    try:
        return backend.launch_job(
            in_path,
            delete_input=delete_input,
            region=region,
            camera_id=camera_id,
        )
    except TypeError:
        # Fallback for older backends that don't accept camera_id
        try:
            return backend.launch_job(
                in_path, delete_input=delete_input, region=region,
            )
        except TypeError:
            return backend.launch_job(in_path, delete_input=delete_input)

def get_region_for_job(job_id):
    """Return 'US' or 'NL' for a running job, by checking which backend
    has the job_id in its jobs dict."""
    if _nl is not None and job_id in _nl.jobs:
        return "NL"
    if _us is not None and job_id in _us.jobs:
        return "US"
    return None