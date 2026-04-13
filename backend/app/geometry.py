from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from .schemas import (
    BoxPreview,
    BoxPreviewRequest,
    CylinderPreview,
    CylinderPreviewRequest,
    ModelPreview,
    ModelPreviewRequest,
    ShapeType,
    SpherePreview,
    SpherePreviewRequest,
    Vector3,
)


class GeometryKernelError(RuntimeError):
    """Raised when CadQuery cannot build the requested model."""


class PreviewableShape(Protocol):
    id: str
    label: str
    color: str
    center: Vector3
    shape_type: ShapeType

    def preview(self) -> ModelPreview:
        ...


DEFAULT_LABELS: dict[ShapeType, str] = {
    "box": "参数盒体",
    "sphere": "参数球体",
    "cylinder": "参数圆柱",
}

DEFAULT_COLORS: dict[ShapeType, str] = {
    "box": "#2f8f83",
    "sphere": "#c85f4f",
    "cylinder": "#d1a02f",
}


def _cadquery():
    try:
        import cadquery as cq
    except Exception as exc:  # pragma: no cover - depends on local CAD kernel install
        raise GeometryKernelError("CadQuery is not available in this Python environment.") from exc

    return cq


def _bounding_box(solid) -> Vector3:
    box = solid.BoundingBox()
    return Vector3(x=box.xlen, y=box.ylen, z=box.zlen)


def _translate_to_center(solid, center: Vector3):
    return solid.translate((center.x, center.y, center.z))


@dataclass(frozen=True)
class BoxShape:
    id: str
    label: str
    color: str
    center: Vector3
    width: float
    height: float
    depth: float
    shape_type: ShapeType = "box"

    def solid(self):
        cq = _cadquery()
        solid = cq.Workplane("XY").box(self.width, self.height, self.depth).val()
        return _translate_to_center(solid, self.center)

    def preview(self) -> BoxPreview:
        solid = self.solid()
        return BoxPreview(
            id=self.id,
            label=self.label,
            color=self.color,
            center=self.center,
            width=self.width,
            height=self.height,
            depth=self.depth,
            volume=solid.Volume(),
            bounding_box=_bounding_box(solid),
        )


@dataclass(frozen=True)
class SphereShape:
    id: str
    label: str
    color: str
    center: Vector3
    radius: float
    shape_type: ShapeType = "sphere"

    def solid(self):
        cq = _cadquery()
        solid = cq.Workplane("XY").sphere(self.radius).val()
        return _translate_to_center(solid, self.center)

    def preview(self) -> SpherePreview:
        solid = self.solid()
        return SpherePreview(
            id=self.id,
            label=self.label,
            color=self.color,
            center=self.center,
            radius=self.radius,
            volume=solid.Volume(),
            bounding_box=_bounding_box(solid),
        )


@dataclass(frozen=True)
class CylinderShape:
    id: str
    label: str
    color: str
    center: Vector3
    radius: float
    height: float
    shape_type: ShapeType = "cylinder"

    def solid(self):
        cq = _cadquery()
        solid = cq.Workplane("XZ").cylinder(self.height, self.radius).val()
        return _translate_to_center(solid, self.center)

    def preview(self) -> CylinderPreview:
        solid = self.solid()
        return CylinderPreview(
            id=self.id,
            label=self.label,
            color=self.color,
            center=self.center,
            radius=self.radius,
            height=self.height,
            volume=solid.Volume(),
            bounding_box=_bounding_box(solid),
        )


DEFAULT_SHAPES: tuple[PreviewableShape, ...] = (
    BoxShape(
        id="box",
        label=DEFAULT_LABELS["box"],
        color=DEFAULT_COLORS["box"],
        center=Vector3(x=0, y=0, z=0),
        width=2.4,
        height=1.2,
        depth=1.5,
    ),
    SphereShape(
        id="sphere",
        label=DEFAULT_LABELS["sphere"],
        color=DEFAULT_COLORS["sphere"],
        center=Vector3(x=0, y=0, z=0),
        radius=1.1,
    ),
    CylinderShape(
        id="cylinder",
        label=DEFAULT_LABELS["cylinder"],
        color=DEFAULT_COLORS["cylinder"],
        center=Vector3(x=0, y=0, z=0),
        radius=0.85,
        height=2.2,
    ),
)


def get_model_previews() -> list[ModelPreview]:
    return [shape.preview() for shape in DEFAULT_SHAPES]


def get_model_preview(shape_type: ShapeType) -> ModelPreview | None:
    for shape in DEFAULT_SHAPES:
        if shape.shape_type == shape_type:
            return shape.preview()
    return None


def build_model_preview(request: ModelPreviewRequest) -> ModelPreview:
    label = request.label or DEFAULT_LABELS[request.shape_type]
    color = request.color or DEFAULT_COLORS[request.shape_type]

    if isinstance(request, BoxPreviewRequest):
        return BoxShape(
            id="box",
            label=label,
            color=color,
            center=request.center,
            width=request.width,
            height=request.height,
            depth=request.depth,
        ).preview()

    if isinstance(request, SpherePreviewRequest):
        return SphereShape(
            id="sphere",
            label=label,
            color=color,
            center=request.center,
            radius=request.radius,
        ).preview()

    if isinstance(request, CylinderPreviewRequest):
        return CylinderShape(
            id="cylinder",
            label=label,
            color=color,
            center=request.center,
            radius=request.radius,
            height=request.height,
        ).preview()

    raise ValueError(f"Unsupported model request: {request.shape_type}")
