import sys
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import app


class SchemaTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)

    def test_health(self) -> None:
        response = self.client.get("/api/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    def test_openapi_contains_model_catalog_schema(self) -> None:
        response = self.client.get("/openapi.json")

        self.assertEqual(response.status_code, 200)
        schemas = response.json()["components"]["schemas"]
        self.assertIn("ModelCatalogResponse", schemas)
        self.assertLessEqual(
            {"BoxPreview", "SpherePreview", "CylinderPreview"},
            set(schemas),
        )


if __name__ == "__main__":
    unittest.main()
