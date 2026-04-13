import sys
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app.main as main_module
from app.schemas import BoxPreview, CylinderPreview, SpherePreview, Vector3


app = main_module.app


def fake_build_model_preview(request):
    if request.shape_type == "box":
        return BoxPreview(
            id="box",
            label=request.label or "参数盒体",
            color=request.color or "#2f8f83",
            center=request.center,
            width=request.width,
            height=request.height,
            depth=request.depth,
            volume=request.width * request.height * request.depth,
            bounding_box=Vector3(x=request.width, y=request.height, z=request.depth),
        )

    if request.shape_type == "sphere":
        diameter = request.radius * 2
        return SpherePreview(
            id="sphere",
            label=request.label or "参数球体",
            color=request.color or "#c85f4f",
            center=request.center,
            radius=request.radius,
            volume=(4 / 3) * 3.141592653589793 * request.radius**3,
            bounding_box=Vector3(x=diameter, y=diameter, z=diameter),
        )

    diameter = request.radius * 2
    return CylinderPreview(
        id="cylinder",
        label=request.label or "参数圆柱",
        color=request.color or "#d1a02f",
        center=request.center,
        radius=request.radius,
        height=request.height,
        volume=3.141592653589793 * request.radius**2 * request.height,
        bounding_box=Vector3(x=diameter, y=request.height, z=diameter),
    )


class SchemaTests(unittest.TestCase):
    def setUp(self) -> None:
        self.original_build_model_preview = main_module.build_model_preview
        main_module.build_model_preview = fake_build_model_preview
        self.client = TestClient(app)

    def tearDown(self) -> None:
        main_module.build_model_preview = self.original_build_model_preview

    def test_health(self) -> None:
        response = self.client.get("/api/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    def test_openapi_contains_model_catalog_schema(self) -> None:
        response = self.client.get("/openapi.json")

        self.assertEqual(response.status_code, 200)
        schemas = response.json()["components"]["schemas"]
        self.assertIn("ModelCatalogResponse", schemas)
        self.assertIn("BoxPreviewRequest", schemas)
        self.assertLessEqual(
            {"BoxPreview", "SpherePreview", "CylinderPreview"},
            set(schemas),
        )
        self.assertIn("/api/models/preview", response.json()["paths"])

    def test_preview_box_returns_cadquery_dimensions(self) -> None:
        response = self.client.post(
            "/api/models/preview",
            json={
                "shape_type": "box",
                "center": {"x": 0.5, "y": 0, "z": -0.5},
                "width": 3,
                "height": 2,
                "depth": 1.5,
            },
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["shape_type"], "box")
        self.assertEqual(payload["center"], {"x": 0.5, "y": 0.0, "z": -0.5})
        self.assertAlmostEqual(payload["volume"], 9)
        self.assertAlmostEqual(payload["bounding_box"]["x"], 3)
        self.assertAlmostEqual(payload["bounding_box"]["y"], 2)
        self.assertAlmostEqual(payload["bounding_box"]["z"], 1.5)

    def test_preview_sphere_returns_radius(self) -> None:
        response = self.client.post(
            "/api/models/preview",
            json={
                "shape_type": "sphere",
                "center": {"x": 0, "y": 1, "z": 0},
                "radius": 1.25,
            },
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["shape_type"], "sphere")
        self.assertAlmostEqual(payload["radius"], 1.25)
        self.assertAlmostEqual(payload["bounding_box"]["x"], 2.5)

    def test_preview_cylinder_returns_radius_and_height(self) -> None:
        response = self.client.post(
            "/api/models/preview",
            json={
                "shape_type": "cylinder",
                "center": {"x": 0, "y": 0, "z": 1},
                "radius": 0.75,
                "height": 3,
            },
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["shape_type"], "cylinder")
        self.assertAlmostEqual(payload["radius"], 0.75)
        self.assertAlmostEqual(payload["height"], 3)
        self.assertAlmostEqual(payload["bounding_box"]["x"], 1.5)
        self.assertAlmostEqual(payload["bounding_box"]["y"], 3)
        self.assertAlmostEqual(payload["bounding_box"]["z"], 1.5)

    def test_preview_rejects_invalid_dimensions(self) -> None:
        response = self.client.post(
            "/api/models/preview",
            json={
                "shape_type": "sphere",
                "center": {"x": 0, "y": 0, "z": 0},
                "radius": 0,
            },
        )

        self.assertEqual(response.status_code, 422)


if __name__ == "__main__":
    unittest.main()
