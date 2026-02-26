#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse
import json
import os
import socket
import sys
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, Optional, Tuple
from urllib.parse import quote, urlparse

import requests


GRAVITINO_ACCEPT = "application/vnd.gravitino.v1+json"


@dataclass(frozen=True)
class GravitinoTableRef:
    uri: str
    metalake: str
    catalog: str
    schema: str
    table: str


def _normalize_base_uri(uri: str) -> str:
    return uri.rstrip("/")


def _gravitino_table_url(ref: GravitinoTableRef) -> str:
    base = _normalize_base_uri(ref.uri)
    return (
        f"{base}/api/metalakes/{quote(ref.metalake)}/catalogs/{quote(ref.catalog)}"
        f"/schemas/{quote(ref.schema)}/tables/{quote(ref.table)}"
    )


def fetch_gravitino_table(ref: GravitinoTableRef, timeout_s: int = 15) -> Dict[str, Any]:
    url = _gravitino_table_url(ref)
    headers = {"Accept": GRAVITINO_ACCEPT}
    resp = requests.get(url, headers=headers, timeout=timeout_s)
    resp.raise_for_status()
    payload = resp.json()

    # Gravitino responses seen in the wild:
    # 1) {"code":0, "table": {...}}
    # 2) {"code":0, "result": {"table": {...}}}
    # 3) {"table": {...}} (rare)
    if isinstance(payload, dict):
        if "table" in payload and isinstance(payload["table"], dict):
            return payload["table"]
        if payload.get("code") == 0 and isinstance(payload.get("result"), dict):
            result = payload["result"]
            if "table" in result and isinstance(result["table"], dict):
                return result["table"]
            # sometimes result itself is the entity
            return result
    raise RuntimeError(f"Unexpected Gravitino response shape: {payload}")


def _as_bool(value: Any) -> Optional[bool]:
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        v = value.strip().lower()
        if v in {"true", "1", "yes", "y", "on"}:
            return True
        if v in {"false", "0", "no", "n", "off"}:
            return False
    return None


def parse_lance_properties(table_obj: Dict[str, Any]) -> Tuple[str, Dict[str, str]]:
    props = table_obj.get("properties") or {}
    if not isinstance(props, dict):
        raise ValueError(f"table.properties is not a dict: {type(props)}")

    location = props.get("location")
    if not location or not isinstance(location, str):
        raise ValueError("Missing required table property: location")

    return location, {str(k): str(v) for k, v in props.items()}


def _maybe_parse_json(value: Any) -> Any:
    if not isinstance(value, str):
        return value
    s = value.strip()
    if not s:
        return value
    if not (s.startswith("{") or s.startswith("[")):
        return value
    try:
        return json.loads(s)
    except Exception:
        return value


def _normalize_gravitino_type(type_obj: Any) -> str:
    """Normalize column type from various Gravitino response shapes into a string."""
    if type_obj is None:
        return "string"
    if isinstance(type_obj, str):
        return type_obj.strip().lower()
    if isinstance(type_obj, dict):
        # Common patterns:
        # - {"type":"integer"}
        # - {"name":"integer"}
        # - {"dataType": {"type": "integer"}}
        if "dataType" in type_obj:
            return _normalize_gravitino_type(type_obj.get("dataType"))
        for key in ("type", "name", "primitive"):
            v = type_obj.get(key)
            if isinstance(v, str) and v.strip():
                return v.strip().lower()
        # Some representations are Iceberg-ish: {"type":"decimal","precision":10,"scale":2}
        if type_obj.get("type") == "decimal":
            p = type_obj.get("precision")
            s = type_obj.get("scale")
            if isinstance(p, int) and isinstance(s, int):
                return f"decimal({p},{s})"
    return str(type_obj).strip().lower()


def _col_nullable(col: Dict[str, Any]) -> bool:
    # Common keys: nullable: bool, required: bool
    if "nullable" in col:
        b = _as_bool(col.get("nullable"))
        if b is not None:
            return b
    if "required" in col:
        b = _as_bool(col.get("required"))
        if b is not None:
            return not b
    return True


def extract_gravitino_columns(table_obj: Dict[str, Any]) -> list[Dict[str, Any]]:
    """Extract columns from Gravitino unified API table payload.

    Returns a list of dicts: {name, type, nullable, comment, raw}.
    """
    candidates: list[Any] = []
    candidates.append(_maybe_parse_json(table_obj.get("columns")))

    schema_obj = _maybe_parse_json(table_obj.get("schema"))
    if isinstance(schema_obj, dict):
        candidates.append(_maybe_parse_json(schema_obj.get("columns")))
        candidates.append(_maybe_parse_json(schema_obj.get("fields")))

    definition_obj = _maybe_parse_json(table_obj.get("definition"))
    if isinstance(definition_obj, dict):
        candidates.append(_maybe_parse_json(definition_obj.get("columns")))

    # Some payloads might use "fields" at top-level
    candidates.append(_maybe_parse_json(table_obj.get("fields")))

    cols_raw = None
    for cand in candidates:
        if isinstance(cand, list) and cand:
            cols_raw = cand
            break

    if cols_raw is None:
        raise ValueError(
            "Cannot find column definitions in Gravitino table payload. "
            "Tried keys: columns, schema.columns, schema.fields, definition.columns, fields. "
            "(Tip: print the payload with --debug-table-json to inspect.)"
        )

    columns: list[Dict[str, Any]] = []
    for c in cols_raw:
        if not isinstance(c, dict):
            # best-effort fallback
            columns.append({"name": str(c), "type": "string", "nullable": True, "comment": "", "raw": c})
            continue
        name = c.get("name") or c.get("columnName") or c.get("fieldName")
        if not name:
            raise ValueError(f"Column missing name: {c}")
        type_str = _normalize_gravitino_type(c.get("type") or c.get("dataType") or c.get("datatype"))
        comment = c.get("comment") or c.get("doc") or c.get("description") or ""
        columns.append(
            {
                "name": str(name),
                "type": type_str,
                "nullable": _col_nullable(c),
                "comment": str(comment) if comment is not None else "",
                "raw": c,
            }
        )
    return columns


def _pyarrow_type_from_type_string(type_str: str):
    import pyarrow as pa

    t = (type_str or "string").strip().lower()
    if t in {"bool", "boolean"}:
        return pa.bool_()
    if t in {"tinyint", "int8", "byte"}:
        return pa.int8()
    if t in {"smallint", "int16", "short"}:
        return pa.int16()
    if t in {"int", "integer", "int32"}:
        return pa.int32()
    if t in {"bigint", "long", "int64"}:
        return pa.int64()
    if t in {"float", "float32", "real"}:
        return pa.float32()
    if t in {"double", "float64"}:
        return pa.float64()
    if t.startswith("decimal"):
        # decimal(p,s)
        try:
            inside = t[t.index("(") + 1 : t.index(")")]
            p_str, s_str = [x.strip() for x in inside.split(",")]
            return pa.decimal128(int(p_str), int(s_str))
        except Exception as e:
            raise ValueError(f"Unsupported decimal type string: {type_str}: {e}")
    if t in {"string", "varchar", "char", "text", "uuid"}:
        return pa.string()
    if t in {"binary", "varbinary", "bytes"}:
        return pa.binary()
    if t in {"date"}:
        return pa.date32()
    if t in {"timestamp", "datetime", "timestamp_ntz"}:
        # Use microseconds for broad compatibility.
        return pa.timestamp("us")

    raise ValueError(
        f"Unsupported column type '{type_str}'. "
        "Add a mapping in _pyarrow_type_from_type_string or adjust your unified API schema."
    )


def build_pyarrow_schema_from_columns(columns: list[Dict[str, Any]]):
    import pyarrow as pa

    fields = []
    for col in columns:
        pa_type = _pyarrow_type_from_type_string(col.get("type", "string"))
        fields.append(pa.field(col["name"], pa_type, nullable=bool(col.get("nullable", True))))
    return pa.schema(fields)


def generate_sample_arrow_table(schema, rows: int = 100, null_rate: float = 0.05):
    import pyarrow as pa

    rows = int(rows)
    if rows <= 0:
        raise ValueError("rows must be > 0")

    base_dt = datetime(2024, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    base_date = date(2024, 1, 1)

    data: Dict[str, list[Any]] = {}
    for field in schema:
        name = field.name
        typ = field.type
        values: list[Any] = []
        for i in range(rows):
            v: Any
            if pa.types.is_boolean(typ):
                v = (i % 2 == 0)
            elif pa.types.is_integer(typ):
                v = i
            elif pa.types.is_floating(typ):
                v = float(i) + 0.25
            elif pa.types.is_decimal(typ):
                scale = typ.scale
                v = Decimal(i) / (Decimal(10) ** scale)
            elif pa.types.is_string(typ):
                v = f"{name}_{i}"
            elif pa.types.is_binary(typ):
                v = f"{name}_{i}".encode("utf-8")
            elif pa.types.is_date32(typ) or pa.types.is_date64(typ):
                v = base_date + timedelta(days=i)
            elif pa.types.is_timestamp(typ):
                v = base_dt + timedelta(seconds=i)
            else:
                raise ValueError(f"Unsupported Arrow type for sample data generation: {name}: {typ}")

            if field.nullable and null_rate > 0 and (i % max(1, int(1 / null_rate)) == 0):
                # Add sparse nulls while keeping determinism.
                values.append(None)
            else:
                values.append(v)
        data[name] = values
    return pa.Table.from_pydict(data, schema=schema)


def build_lance_storage_options_from_props(props: Dict[str, str]) -> Dict[str, str]:
    endpoint = props.get("lance.storage.endpoint")
    access_key = props.get("lance.storage.access_key_id")
    secret_key = props.get("lance.storage.secret_access_key")
    allow_http = _as_bool(props.get("lance.storage.allow_http"))

    if not endpoint:
        raise ValueError("Missing required table property: lance.storage.endpoint")
    if not access_key:
        raise ValueError("Missing required table property: lance.storage.access_key_id")
    if not secret_key:
        raise ValueError("Missing required table property: lance.storage.secret_access_key")

    # Lance uses object_store-style options for S3. Keep both common key spellings to
    # be compatible across versions/backends.
    # Endpoint should include scheme.
    parsed = urlparse(endpoint)
    if parsed.scheme:
        endpoint_with_scheme = endpoint
    else:
        endpoint_with_scheme = ("http://" if allow_http else "https://") + endpoint

    options: Dict[str, str] = {
        "aws_access_key_id": access_key,
        "aws_secret_access_key": secret_key,
        # Always set a region to avoid SDK attempts to infer it (which can hang in some envs).
        "aws_region": props.get("aws.region", "us-east-1"),
        "aws_endpoint": endpoint_with_scheme,
        "aws_allow_http": "true" if allow_http else "false",
        # S3-compatible deployments often need path-style access.
        "aws_virtual_hosted_style_request": "false",
    }
    return options


def _check_tcp_connect(host: str, port: int, timeout_s: float = 3.0) -> None:
    try:
        with socket.create_connection((host, port), timeout=timeout_s):
            return
    except OSError as e:
        raise RuntimeError(f"Cannot reach S3 endpoint {host}:{port} (tcp connect failed): {e}")


def _preflight_s3_endpoint(storage_options: Dict[str, str], timeout_s: float = 3.0) -> None:
    endpoint = storage_options.get("aws_endpoint")
    if not endpoint:
        return
    parsed = urlparse(endpoint)
    host = parsed.hostname
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    if not host:
        return
    _check_tcp_connect(host, port, timeout_s=timeout_s)


def write_rows_to_lance(location: str, storage_options: Dict[str, str], arrow_table) -> None:
    import lance

    # Overwrite so the script is deterministic.
    lance.write_dataset(arrow_table, location, mode="overwrite", storage_options=storage_options)


def query_with_datafusion(location: str, storage_options: Dict[str, str], table_name: str, sql: str):
    import pyarrow as pa
    import lance
    from datafusion import SessionContext

    ds = lance.dataset(location, storage_options=storage_options)
    arrow_table = ds.to_table()

    ctx = SessionContext()
    # DataFusion expects List[List[RecordBatch]]: outer list is partitions, inner is batches per partition
    ctx.register_record_batches(table_name, [arrow_table.to_batches()])

    # Use double quotes to be safe for identifiers.
    _ = table_name.replace('"', '""')
    sql = (sql or "").strip()
    if not sql:
        raise ValueError("sql must be non-empty")
    df = ctx.sql(sql)
    batches = df.collect()
    result_table = pa.Table.from_batches(batches)
    return sql, result_table


def main() -> int:
    parser = argparse.ArgumentParser(description="Query a Lance table via Gravitino unified API and DataFusion SQL")
    parser.add_argument(
        "--gravitino-uri",
        default=os.getenv("GRAVITINO_URI", "http://172.29.119.193:18090"),
        help="Gravitino unified API base URI (e.g. http://host:port)",
    )
    parser.add_argument(
        "--metalake",
        default=os.getenv("GRAVITINO_METALAKE", "lakehouse_metalake"),
        help="Gravitino metalake name",
    )
    parser.add_argument(
        "--catalog",
        default=os.getenv("GRAVITINO_CATALOG", "lance_catalog"),
        help="Gravitino catalog name",
    )
    parser.add_argument(
        "--namespace",
        default=os.getenv("ICEBERG_NAMESPACE", os.getenv("GRAVITINO_NAMESPACE", "s1")),
        help="Namespace (schema) name",
    )
    parser.add_argument(
        "--table",
        default=os.getenv("ICEBERG_TABLE", os.getenv("GRAVITINO_TABLE", "product")),
        help="Table name",
    )
    parser.add_argument(
        "--rows",
        type=int,
        default=int(os.getenv("WRITE_ROWS", "100")),
        help="Rows to generate and write (overwrite)",
    )
    parser.add_argument(
        "--sql",
        default=os.getenv("QUERY_SQL", ""),
        help='SQL to execute in DataFusion (default: SELECT * FROM "<table>" LIMIT 10)',
    )
    parser.add_argument(
        "--no-write",
        action="store_true",
        help="Do not overwrite data; only query the existing Lance dataset",
    )
    parser.add_argument(
        "--skip-endpoint-check",
        action="store_true",
        help="Skip TCP reachability check for S3 endpoint",
    )
    parser.add_argument(
        "--endpoint-check-timeout",
        type=float,
        default=float(os.getenv("ENDPOINT_CHECK_TIMEOUT", "3")),
        help="Timeout seconds for S3 endpoint TCP reachability check",
    )
    parser.add_argument(
        "--debug-table-json",
        action="store_true",
        help="Print the raw Gravitino table JSON payload (useful to see where columns live)",
    )
    args = parser.parse_args()

    # Avoid long stalls on metadata/IMDS in cloud-like envs.
    os.environ.setdefault("AWS_EC2_METADATA_DISABLED", "true")

    ref = GravitinoTableRef(
        uri=args.gravitino_uri,
        metalake=args.metalake,
        catalog=args.catalog,
        schema=args.namespace,
        table=args.table,
    )

    print("[1/4] Fetching table metadata from Gravitino...")
    table_obj = fetch_gravitino_table(ref)
    print(f"- Table: {table_obj.get('name')}")

    if args.debug_table_json:
        print("- Gravitino table payload:")
        print(json.dumps(table_obj, indent=2, ensure_ascii=False, sort_keys=True))

    print("- Columns (from unified API):")
    columns = extract_gravitino_columns(table_obj)
    try:
        from tabulate import tabulate

        col_rows = [[c["name"], c["type"], str(bool(c["nullable"])).lower(), c.get("comment", "")] for c in columns]
        print(tabulate(col_rows, headers=["name", "type", "nullable", "comment"], tablefmt="grid", showindex=False))
    except Exception:
        # If tabulate isn't available, fall back to a simple print.
        for c in columns:
            print(f"  - {c['name']}: {c['type']} nullable={c['nullable']} comment={c.get('comment','')}")

    print("[2/4] Parsing Lance properties...")
    location, props = parse_lance_properties(table_obj)
    print(f"- location: {location}")

    storage_options = build_lance_storage_options_from_props(props)
    if not args.skip_endpoint_check:
        _preflight_s3_endpoint(storage_options, timeout_s=args.endpoint_check_timeout)

    if args.no_write:
        print("[3/4] Skipping overwrite (--no-write)...")
    else:
        print("[3/4] Writing sample rows to Lance dataset (overwrite)...")
        arrow_schema = build_pyarrow_schema_from_columns(columns)
        arrow_table = generate_sample_arrow_table(arrow_schema, rows=args.rows)
        write_rows_to_lance(location, storage_options, arrow_table)

    print("[4/4] Querying with DataFusion SQL...")

    safe_table = args.table.replace('"', '""')
    sql_to_run = args.sql.strip() or f'SELECT * FROM "{safe_table}" LIMIT 10'
    sql, result_table = query_with_datafusion(location, storage_options, args.table, sql=sql_to_run)
    print(f"- SQL: {sql}")

    if result_table.num_rows == 0:
        raise RuntimeError(
            "Query returned 0 rows. "
            "If you used --where, verify it matches the generated sample data, or run with an empty --where."
        )

    # 标准SQL查询结果表格化输出
    from tabulate import tabulate

    result_dict = result_table.to_pydict()
    print("- Result (table format):")
    # 获取列名和行数据
    result_columns = list(result_dict.keys())
    result_rows = list(zip(*(result_dict[col] for col in result_columns)))
    print(tabulate(result_rows, headers=result_columns, tablefmt="grid", showindex=False))

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        raise
