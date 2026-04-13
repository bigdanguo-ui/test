# OpenAPI CAD Preview

一个最小的 Python + OpenAPI + React 示例：

- 后端使用 FastAPI 暴露 OpenAPI schema。
- 后端使用 CadQuery 创建 box、sphere、cylinder 三类几何体，并返回体积与包围盒。
- 前端使用 React、TypeScript、Three.js 渲染三维预览。
- 前端类型通过 `openapi-typescript` 从 `backend/openapi.json` 生成。

## 目录

```text
backend/
  app/
    geometry.py       CadQuery 几何类
    main.py           FastAPI 入口
    schemas.py        Pydantic/OpenAPI 类型契约
  export_openapi.py   导出 OpenAPI JSON
frontend/
  src/
    api/              OpenAPI 共享类型与请求封装
    main.tsx          三维预览界面
```

## 安装

```powershell
python -m pip install -r backend\requirements.txt
Set-Location .\frontend
npm install
Set-Location ..
```

## 生成 OpenAPI 类型

```powershell
npm run openapi
npm run gen:types
```

`frontend/src/api/schema.d.ts` 已包含生成后的类型。后端 schema 调整后请重新运行上面的命令。

## 启动

打开两个终端：

```powershell
npm run backend
```

```powershell
npm run frontend
```

前端默认运行在 `http://127.0.0.1:5173`，后端默认运行在 `http://127.0.0.1:8000`。

## 验证

```powershell
python backend\export_openapi.py
npm run gen:types
python -m unittest discover backend\tests
npm run build
```

## Windows CadQuery 说明

当前环境里 CadQuery 2.5.2 可以完成建模和体积计算，但 Python 进程退出时出现过 access violation。若本机也遇到相同问题，建议改用 CadQuery 官方推荐的 Conda 环境或 Python 3.11 运行后端。
