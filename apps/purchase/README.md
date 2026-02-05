# Enigma Purchase App - Documentación Técnica 📘

Este módulo es una aplicación web independiente (**Standalone Web App**) diseñada para gestionar el ciclo de compras, costos y proveedores de Enigma, integrándose lógica y visualmente con la arquitectura de Enigma OS pero funcionando de manera autónoma.

## 🏗 Arquitectura del Sistema

- **Stack**: Python 3 (Flask) + SQLite + TailwindCSS (Frontend).
- **Modelo de Ejecución**: Servidor local WSGI (Gunicorn-ready) corriendo en puerto `5001`.
- **Persistencia**: Base de datos relacional SQLite (`purchase_app.db`) local, portable y de alta velocidad.
- **Integración Datos**:
    - **Input**: Importación masiva desde CSV de Loyverse (`export_items.csv`).
    - **Output**: Exportación de reportes en CSV.
    - **Lógica Híbrida**: Se separa el catálogo (Lectura) del historial de compras (Escritura).

## 🧩 Módulos Funcionales

### 1. Hub Central (`/`)
Dashboard principal que centraliza la navegación. Actúa como el "Control Center" del módulo, dando acceso rápido a las 3 verticales: Registro, Análisis y Configuración.

### 2. Motor de Compras (`/new-purchase`)
El núcleo transaccional del sistema.
- **Provider Memory**: Sistema inteligente que recuerda y autocompleta proveedores basado en inputs previos.
- **Smart Catalog Search**: Buscador optimizado con *Debounce* para filtrar miles de ingredientes en milisegundos.
- **Unit Inference Engine**:
    - Detecta automáticamente si un producto se compra por **Peso (Kg)** o **Unidad (Und)** analizando la columna `Vendido por peso` del CSV de Loyverse.
    - Adapta la interfaz de usuario para mostrar la unidad correcta.
- **Cost Calculation Logic**:
    - Calcula el costo unitario real al vuelo (`Total Pagado / Cantidad`).
    - Compara contra el `current_cost` almacenado y genera alertas: 🔺 (Subió), ⬇️ (Bajó), = (Igual).

### 3. Sistema de Análisis
Herramientas para la toma de decisiones basada en datos.
- **Monitor de Precios (`/price-monitor`)**: Vista maestra de todo el catálogo con su último costo registrado y proveedor.
- **Comparador de Proveedores (`/comparison`)**:
    - Algoritmo que agrupa compras históricas por `catalog_item_id`.
    - Renderiza una tabla comparativa mostrando quién vendió el producto, a qué precio y cuándo.
    - Destaca automáticamente la **mejor oferta**.
- **Historial de Proveedor (`/provider-detail/<id>`)**: Vista detallada de la relación comercial con un proveedor específico (Total gastado, items comprados).

### 4. Gestión de Datos (`/settings`)
Módulo de administración de la integridad de datos.
- **ETL de Importación**: API Endpoint (`/api/settings/upload-catalog`) que procesa archivos CSV crudos de Loyverse, actualiza precios, crea nuevos productos y detecta nuevos proveedores automáticamente.
- **Exportación Contable**: Generador de CSV (`/api/export/purchases`) que vuelca la tabla `purchases` y `purchase_lines` en un formato plano compatible con Excel/Google Sheets para auditoría.

## 💾 Estructura de Datos (Schema)

### `providers`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | PK | ID único |
| name | TEXT | Nombre normalizado |
| category | TEXT | Etiqueta de clasificación |

### `catalog_items` (Espejo Loyverse)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| loyverse_id | UUID | Enlace con sistema POS |
| sku | STR | Código de barras/interno |
| name | STR | Nombre del producto |
| default_unit | STR | 'kg' o 'und' (Inferido) |
| current_cost | FLOAT| Último costo registrado |

### `purchases` (Header)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | PK | ID Transacción |
| date | DATETIME | Timestamp de compra |
| total_amount| FLOAT| Monto total factura |

### `purchase_lines` (Detail)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| quantity | FLOAT | Cantidad comprada |
| unit_cost | FLOAT | Costo calculado |
| total_cost | FLOAT | Subtotal línea |

---
*Desarrollado para Enigma OS V2 - Enero 2026*
