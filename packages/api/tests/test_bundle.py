"""Guards the Lambda bundle: the deployed code must import the API and the db package from the bundle alone.

`-I -S` drops the virtualenv site-packages (where both packages are installed editable), leaving only the
standard library and the bundle on the path. `-B` keeps __pycache__ out of the bundle, which is zipped as is.
"""

import subprocess
import sys
from pathlib import Path

import pytest

BUNDLE_DIR = Path(__file__).resolve().parents[3] / "dist" / "packages" / "api" / "bundle-x86"


@pytest.mark.skipif(not BUNDLE_DIR.is_dir(), reason="bundle not built (run nx bundle-x86 first)")
def test_should_import_the_api_and_the_db_package_when_only_the_bundle_is_on_the_path():
    code = f"import sys; sys.path.insert(0, {str(BUNDLE_DIR)!r}); import stardew_valley_api.main, stardew_valley_db"
    out = subprocess.run([sys.executable, "-B", "-I", "-S", "-c", code], capture_output=True, text=True, cwd="/")
    assert out.returncode == 0, out.stderr
