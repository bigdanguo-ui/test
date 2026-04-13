from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from .schemas import (
    BoxPreview,
    CylinderPreview,
    ModelPreview,
    ShapeType,
    SpherePreview,
    Vector3,
)


class GeometryKernelError(RuntimeError):
    """Raised when CadQuery cannot build the requested model."""


class PreviewableShape(Protocol):
    id: str
    label: str
    color: str
    shape_type: ShapeType

    def preview(self) -> ModelPreview:
        ...


def _cadquery():
    try:
        import cadquery as cq
    except Exception as exc:  # pragma: no cover - depends on local CAD kernel install
        raise GeometryKernelError("CadQuery is not available in this Python environment.") from exc

    return cq


def _bounding_box(solid) -> Vector3:
    box = solid.BoundingBox()
    return Vector3(x=box.xlen, y=box.ylen, z=box.zlen)


@dataclass(frozen=True)
class BoxShape:
    id: str
    label: str
    color: str
    width: float
    height: float
    depth: float
    shape_type: ShapeType = "box"

    def solid(self):
        cq = _cadquery()
        return cq.Workplane("XY").box(self.width, self.height, self.depth).val()

    def preview(self) -> BoxPreview:
        solid = self.solid()
        return BoxPreview(
            id=self.id,
            label=self.label,
            color=self.color,
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
    radius: float
    shape_type: ShapeType = "sphere"

    def solid(self):
        cq = _cadquery()
        return cq.Workplane("XY").sphere(self.radius).val()

    def preview(self) -> SpherePreview:
        solid = self.solid()
        return SpherePreview(
            id=self.id,
            label=self.label,
            color=self.color,
            radius=self.radius,
            volume=solid.Volume(),
            bounding_box=_bounding_box(solid),
        )


@dataclass(frozen=True)
class CylinderShape:
    id: str
    label: str
    color: str
    radius: float
    height: float
    shape_type: ShapeType = "cylinder"

    def solid(self):
        cq = _cadquery()
        return cq.Workplane("XY").cylinder(self.height, self.radius).val()

    def preview(self) -> CylinderPreview:
        solid = self.solid()
        return CylinderPreview(
            id=self.id,
            label=self.label,
            color=self.color,
            radius=self.radius,
            height=self.height,
            volume=solid.Volume(),
            bounding_box=_bounding_box(solid),
        )


DEFAULT_SHAPES: tuple[PreviewableShape, ...] = (
    BoxShape(
        id="box",
        label="参数盒体",
        color="#2f8f83",
        width=2.4,
        height=1.2,
        depth=1.5,
    ),
    SphereShape(
        id="sphere",
        label="参数球体",
        color="#c85f4f",
        radius=1.1,
    ),
    CylinderShape(
        id="cylinder",
        label="参数圆柱",
        color="#d1a02f",
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
