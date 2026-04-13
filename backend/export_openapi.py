from __future__ import annotations

import json
from pathlib import Path

from app.main import app


OUTPUT_PATH = Path(__file__).resolve().parent / "openapi.json"


def main() -> None:
    OUTPUT_PATH.write_text(
        json.dumps(app.openapi(), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
