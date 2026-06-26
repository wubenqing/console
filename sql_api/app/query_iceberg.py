#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse
import os
import random
import socket
import sys
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional, Sequence, Tuple
from urllib.parse import quote, urlparse

import requests


GRAVITINO_ACCEPT = "application/vnd.gravitino.v1+json"


def fetch_gravitino_catalog_properties(
    gravitino_uri: str,
    metalake: str,
    catalog: str,
    timeout_s: float = 10.0,
) -> Dict[str, str]:
    """Fetch catalog properties from Gravitino unified API.

    This is only used to obtain storage connection properties (e.g. S3 endpoint
    and access keys). All Iceberg catalog/table metadata operations are still
    performed through the Iceberg REST catalog.
    """

    base = (gravitino_uri or "").rstrip("/")
    if not base:
        raise ValueError("gravitino_uri must be non-empty")
    if not metalake:
        raise ValueError("metalake must be non-empty")
    if not catalog:
        raise ValueError("catalog must be non-empty")

    url = f"{base}/api/metalakes/{quote(metalake)}/catalogs/{quote(catalog)}"
    resp = requests.get(url, headers={"Accept": GRAVITINO_ACCEPT}, timeout=timeout_s)
    resp.raise_for_status()
    payload = resp.json()

    entity: Optional[Dict[str, Any]] = None
    if isinstance(payload, dict):
        if isinstance(payload.get("catalog"), dict):
            entity = payload["catalog"]
        elif payload.get("code") == 0 and isinstance(payload.get("result"), dict):
            result = payload["result"]
            if isinstance(result.get("catalog"), dict):
                entity = result["catalog"]
            else:
                entity = result

    if not entity or not isinstance(entity, dict):
        raise RuntimeError(f"Unexpected Gravitino catalog response shape: {payload}")

    props = entity.get("properties") or {}
    if not isinstance(props, dict):
        raise RuntimeError(f"catalog.properties is not a dict: {type(props)}")
    return {str(k): str(v) for k, v in props.items()}


def _check_tcp_connect(host: str, port: int, timeout_s: float = 3.0) -> None:
    try:
        with socket.create_connection((host, port), timeout=timeout_s):
            return
    except OSError as e:
        raise RuntimeError(f"Cannot reach endpoint {host}:{port} (tcp connect failed): {e}")


def _preflight_endpoint(endpoint: str, timeout_s: float = 3.0) -> None:
    parsed = urlparse(endpoint)
    host = parsed.hostname
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    if host:
        _check_tcp_connect(host, port, timeout_s=timeout_s)


def _normalize_http_base_uri(uri: str) -> str:
    return (uri or "").strip().rstrip("/")


def _probe_iceberg_rest_v1_config(base_uri: str, timeout_s: float = 3.0) -> Tuple[bool, bool]:
    """Return (supported, warehouse_required).

    Some Iceberg REST implementations (e.g. Gravitino Iceberg REST) may require
    a `warehouse` query parameter to select a backing catalog and will return
    a JSON error with HTTP 400 when it is missing.
    """

    base = _normalize_http_base_uri(base_uri)
    if not base:
        return False, False

    try:
        resp = requests.get(f"{base}/v1/config", timeout=timeout_s)
        # Must be JSON (either config or JSON error)
        payload = resp.json()

        if resp.status_code == 200 and isinstance(payload, dict):
            return True, False

        if resp.status_code == 400 and isinstance(payload, dict):
            # Gravitino error shape: {"error": {"message": "...warehouse..."}}
            msg = ""
            if isinstance(payload.get("error"), dict):
                msg = str(payload["error"].get("message") or "")
            if "use `warehouse`" in msg.lower() or "default-catalog-name" in msg.lower():
                return True, True

        return False, False
    except Exception:
        return False, False


def resolve_iceberg_rest_uri(uri: str, timeout_s: float = 3.0) -> Tuple[str, bool]:
    """Resolve the actual REST base URI that exposes `/v1/config`.

    Some deployments mount the Iceberg REST service under a context path
    (e.g. `http://host:port/iceberg`). This helper tries common variants.
    """
    raw = (uri or "").strip()
    if not raw:
        raise ValueError("rest uri must be non-empty")

    candidates = [
        raw,
        raw.rstrip("/") + "/iceberg",
        raw.rstrip("/") + "/iceberg/rest",
        raw.rstrip("/") + "/api/iceberg",
        raw.rstrip("/") + "/iceberg-catalog",
    ]

    for candidate in candidates:
        ok, warehouse_required = _probe_iceberg_rest_v1_config(candidate, timeout_s=timeout_s)
        if ok:
            return _normalize_http_base_uri(candidate), warehouse_required

    tried = ", ".join(_normalize_http_base_uri(c) for c in candidates)
    raise RuntimeError(
        "Could not find an Iceberg REST v1 endpoint (missing `/v1/config`). "
        f"Tried: {tried}. "
        "If your service is mounted under a custom path, pass the full base URI (including the path) via --rest-uri."
    )


def create_rest_catalog(name: str, **properties: Any):
    """Create a PyIceberg REST catalog but do not auto-request access delegation.

    PyIceberg's built-in RestCatalog sets `X-Iceberg-Access-Delegation` by default.
    Some Gravitino Iceberg REST deployments will reject requests if the client asks
    for vended credentials but the catalog doesn't have a credential provider.

    By avoiding a default here, we match `curl`-style behavior: only send the header
    when explicitly configured.
    """

    from pyiceberg import __version__ as _pyiceberg_version
    from pyiceberg.catalog.rest import get_header_properties
    from pyiceberg.catalog.rest import RestCatalog as _RestCatalog

    class _NoDefaultDelegationRestCatalog(_RestCatalog):
        def _config_headers(self, session):
            header_properties = get_header_properties(self.properties)
            session.headers.update(header_properties)
            session.headers["Content-type"] = "application/json"
            session.headers["User-Agent"] = f"PyIceberg/{_pyiceberg_version}"

    return _NoDefaultDelegationRestCatalog(name, **properties)


def _namespace_tuple(namespace: str) -> Tuple[str, ...]:
    namespace = (namespace or "").strip()
    if not namespace:
        raise ValueError("namespace must be non-empty")
    return tuple(p for p in namespace.split(".") if p)


def _table_identifier(namespace: str, table: str) -> Tuple[str, ...]:
    table = (table or "").strip()
    if not table:
        raise ValueError("table must be non-empty")
    return (*_namespace_tuple(namespace), table)


def _table_location_str(table: Any) -> str:
    # PyIceberg Table exposes both metadata and helper methods across versions.
    try:
        loc = table.location()
        if isinstance(loc, str):
            return loc
    except Exception:
        pass
    try:
        loc = getattr(getattr(table, "metadata", None), "location", None)
        if isinstance(loc, str):
            return loc
    except Exception:
        pass
    return ""


def _requires_s3_credentials(location: str) -> bool:
    loc = (location or "").strip().lower()
    return loc.startswith("s3://") or loc.startswith("s3a://") or loc.startswith("s3n://")


def _has_env_s3_credentials() -> bool:
    return bool(os.getenv("AWS_ACCESS_KEY_ID") and os.getenv("AWS_SECRET_ACCESS_KEY"))


def _pyarrow_type_from_iceberg(field_type: Any):
    import pyarrow as pa
    from pyiceberg.types import (
        BinaryType,
        BooleanType,
        DateType,
        DecimalType,
        DoubleType,
        FixedType,
        FloatType,
        IntegerType,
        LongType,
        StringType,
        TimestampType,
        TimestamptzType,
        UUIDType,
    )

    if isinstance(field_type, StringType):
        return pa.string()
    if isinstance(field_type, IntegerType):
        return pa.int32()
    if isinstance(field_type, LongType):
        return pa.int64()
    if isinstance(field_type, BooleanType):
        return pa.bool_()
    if isinstance(field_type, FloatType):
        return pa.float32()
    if isinstance(field_type, DoubleType):
        return pa.float64()
    if isinstance(field_type, DateType):
        return pa.date32()
    if isinstance(field_type, TimestampType):
        return pa.timestamp("us")
    if isinstance(field_type, TimestamptzType):
        return pa.timestamp("us", tz="UTC")
    if isinstance(field_type, DecimalType):
        return pa.decimal128(field_type.precision, field_type.scale)
    if isinstance(field_type, (BinaryType, FixedType)):
        return pa.binary()
    if isinstance(field_type, UUIDType):
        return pa.string()

    # Complex/nested types can be added when needed.
    raise ValueError(f"Unsupported Iceberg type for random generation: {field_type}")


def _random_string(n: int = 8) -> str:
    alphabet = "abcdefghijklmnopqrstuvwxyz"
    return "".join(random.choice(alphabet) for _ in range(n))


def generate_random_arrow_table_from_iceberg_schema(schema, num_rows: int = 100, null_pct: float = 0.05):
    import pyarrow as pa
    from pyiceberg.types import (
        BooleanType,
        DateType,
        DecimalType,
        DoubleType,
        FloatType,
        IntegerType,
        LongType,
        StringType,
        TimestampType,
        TimestamptzType,
    )

    # A list of 200+ common English first names (no duplicates)
    ENGLISH_NAMES = [
        'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth',
        'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen',
        'Christopher', 'Nancy', 'Daniel', 'Lisa', 'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra',
        'Donald', 'Ashley', 'Steven', 'Kimberly', 'Paul', 'Emily', 'Andrew', 'Donna', 'Joshua', 'Michelle',
        'Kenneth', 'Dorothy', 'Kevin', 'Carol', 'Brian', 'Amanda', 'George', 'Melissa', 'Edward', 'Deborah',
        'Ronald', 'Stephanie', 'Timothy', 'Rebecca', 'Jason', 'Sharon', 'Jeffrey', 'Laura', 'Ryan', 'Cynthia',
        'Jacob', 'Kathleen', 'Gary', 'Amy', 'Nicholas', 'Shirley', 'Eric', 'Angela', 'Stephen', 'Helen',
        'Jonathan', 'Anna', 'Larry', 'Brenda', 'Justin', 'Pamela', 'Scott', 'Nicole', 'Brandon', 'Emma',
        'Benjamin', 'Samantha', 'Samuel', 'Katherine', 'Gregory', 'Christine', 'Frank', 'Debra', 'Alexander', 'Rachel',
        'Raymond', 'Catherine', 'Patrick', 'Carolyn', 'Jack', 'Janet', 'Dennis', 'Ruth', 'Jerry', 'Maria',
        'Tyler', 'Heather', 'Aaron', 'Diane', 'Jose', 'Virginia', 'Henry', 'Julie', 'Adam', 'Joyce',
        'Douglas', 'Victoria', 'Nathan', 'Olivia', 'Peter', 'Kelly', 'Zachary', 'Christina', 'Kyle', 'Lauren',
        'Walter', 'Joan', 'Harold', 'Evelyn', 'Jeremy', 'Judith', 'Ethan', 'Megan', 'Carl', 'Cheryl',
        'Keith', 'Andrea', 'Roger', 'Hannah', 'Gerald', 'Martha', 'Christian', 'Jacqueline', 'Terry', 'Frances',
        'Sean', 'Gloria', 'Arthur', 'Ann', 'Austin', 'Teresa', 'Noah', 'Kathryn', 'Lawrence', 'Sara',
        'Jesse', 'Janice', 'Joe', 'Jean', 'Bryan', 'Alice', 'Billy', 'Madison', 'Jordan', 'Doris',
        'Albert', 'Abigail', 'Dylan', 'Julia', 'Bruce', 'Judy', 'Willie', 'Grace', 'Gabriel', 'Denise',
        'Alan', 'Amber', 'Juan', 'Marilyn', 'Logan', 'Beverly', 'Wayne', 'Danielle', 'Ralph', 'Theresa',
        'Roy', 'Sophia', 'Eugene', 'Marie', 'Randy', 'Diana', 'Vincent', 'Brittany', 'Russell', 'Natalie',
        'Louis', 'Isabella', 'Philip', 'Charlotte', 'Bobby', 'Rose', 'Johnny', 'Alexis', 'Bradley', 'Kayla',
        'Johnny', 'Alexis', 'Bradley', 'Kayla', 'Mason', 'Lori', 'Howard', 'Courtney', 'Eugene', 'Stacy',
        'Carlos', 'Kathleen', 'Logan', 'Vanessa', 'Billy', 'April', 'Austin', 'Leslie', 'Willie', 'Kristen',
        'Jordan', 'Rachel', 'Dylan', 'Shelby', 'Bruce', 'Kaitlyn', 'Gabriel', 'Tiffany', 'Ralph', 'Hayden',
        'Roy', 'Avery', 'Vincent', 'Brooklyn', 'Russell', 'Camila', 'Louis', 'Paisley', 'Philip', 'Mackenzie',
        'Bobby', 'Mya', 'Johnny', 'Payton', 'Bradley', 'Ellie', 'Kayla', 'Melanie', 'Mason', 'Naomi',
        'Lori', 'Faith', 'Howard', 'Kylie', 'Courtney', 'Alexa', 'Eugene', 'Caroline', 'Stacy', 'Genesis',
    ]
    # Remove duplicates and shuffle
    import random
    ENGLISH_NAMES = list(dict.fromkeys(ENGLISH_NAMES))
    random.shuffle(ENGLISH_NAMES)

    now_naive = datetime.now(timezone.utc).replace(tzinfo=None)
    today = date.today()

    arrays: Dict[str, Any] = {}
    arrow_fields: List[pa.Field] = []

    for field in schema.fields:
        name = field.name
        required = bool(field.required)
        pa_type = _pyarrow_type_from_iceberg(field.field_type)
        arrow_fields.append(pa.field(name, pa_type, nullable=not required))

        values: List[Any] = []
        for i in range(num_rows):
            if (not required) and random.random() < null_pct:
                values.append(None)
                continue

            t = field.field_type
            if isinstance(t, StringType) and name == "name":
                # Use unique English names for the 'name' column
                if i < len(ENGLISH_NAMES):
                    values.append(ENGLISH_NAMES[i])
                else:
                    # If more rows than names, fallback to random string
                    values.append(_random_string(8))
            elif isinstance(t, StringType):
                values.append(_random_string(8))
            elif isinstance(t, IntegerType):
                values.append(random.randint(0, 120))
            elif isinstance(t, LongType):
                values.append(random.randint(0, 10_000_000))
            elif isinstance(t, BooleanType):
                values.append(random.choice([True, False]))
            elif isinstance(t, FloatType):
                values.append(random.random() * 100)
            elif isinstance(t, DoubleType):
                values.append(random.random() * 1000)
            elif isinstance(t, DateType):
                values.append(today)
            elif isinstance(t, (TimestampType, TimestamptzType)):
                values.append(now_naive)
            elif isinstance(t, DecimalType):
                # Keep it simple: generate a small integer as a decimal.
                values.append(str(random.randint(0, 10_000)))
            else:
                raise ValueError(f"Unsupported type for random generation: {t}")

        arrays[name] = pa.array(values, type=pa_type)

    arrow_schema = pa.schema(arrow_fields)
    return pa.Table.from_pydict(arrays, schema=arrow_schema)


def ensure_namespace(catalog, namespace: str) -> None:
    try:
        catalog.create_namespace(_namespace_tuple(namespace))
    except Exception:
        return


def load_or_create_iceberg_table(
    catalog,
    namespace: str,
    table_name: str,
    schema,
    location: str,
    table_properties: Optional[Dict[str, str]] = None,
):
    from pyiceberg.exceptions import NoSuchTableError

    identifier = _table_identifier(namespace, table_name)
    try:
        return catalog.load_table(identifier)
    except NoSuchTableError:
        ensure_namespace(catalog, namespace)
        return catalog.create_table(identifier, schema=schema, location=location, properties=table_properties or {})


def query_with_datafusion_from_arrow(table_name: str, arrow_table, sql: str):
    import pyarrow as pa
    from datafusion import SessionContext

    ctx = SessionContext()
    batches = arrow_table.to_batches()
    if not batches:
        # DataFusion python bindings can panic if we register an empty partitions list.
        schema = arrow_table.schema
        empty_arrays = [pa.array([], type=field.type) for field in schema]
        empty_batch = pa.RecordBatch.from_arrays(empty_arrays, schema=schema)
        ctx.register_record_batches(table_name, [[empty_batch]])
    else:
        # Outer list is partitions, inner is batches per partition.
        ctx.register_record_batches(table_name, [batches])

    df = ctx.sql(sql)
    batches = df.collect()
    return pa.Table.from_batches(batches)


def print_arrow_table_as_sql_result(arrow_table) -> None:
    from tabulate import tabulate

    if arrow_table is None or arrow_table.num_rows == 0:
        print("(0 rows)")
        return

    result_dict = arrow_table.to_pydict()
    columns = list(result_dict.keys())
    rows = list(zip(*(result_dict[col] for col in columns)))
    print(tabulate(rows, headers=columns, tablefmt="grid", showindex=False))


def _print_identifiers(title: str, identifiers: Sequence[Tuple[str, ...]]) -> None:
    print(title)
    if not identifiers:
        print("(empty)")
        return
    for ident in identifiers:
        print(f"- {'.'.join(ident)}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Query an Iceberg table via Iceberg REST catalog and DataFusion SQL")
    parser.add_argument(
        "--rest-uri",
        default=os.getenv("ICEBERG_REST_URI", "http://172.29.119.193:19102"),
        help="Iceberg REST catalog base URI (e.g. http://host:port or https://host:port)",
    )
    parser.add_argument(
        "--rest-uri-timeout",
        type=float,
        default=float(os.getenv("ICEBERG_REST_URI_TIMEOUT", "3")),
        help="Timeout seconds for probing REST `/v1/config` during URI resolution",
    )
    parser.add_argument(
        "--rest-catalog-name",
        default=os.getenv("ICEBERG_REST_CATALOG", "rest"),
        help="Local name for the REST catalog (PyIceberg config key)",
    )
    parser.add_argument(
        "--bearer-token",
        default=os.getenv("ICEBERG_REST_BEARER_TOKEN", ""),
        help="Optional Bearer token for REST requests (adds header Authorization: Bearer <token>)",
    )
    parser.add_argument(
        "--auth-type",
        default=os.getenv("ICEBERG_REST_AUTH_TYPE", "noop"),
        choices=["noop", "legacyoauth2", "oauth2", "basic", "google"],
        help=(
            "REST auth manager type. Default 'noop' (no auth) to avoid sending an invalid "
            "Authorization header to servers that don't require auth."
        ),
    )
    parser.add_argument(
        "--credential",
        default=os.getenv("ICEBERG_REST_CREDENTIAL", ""),
        help="Optional OAuth2 client credential in the form client_id:client_secret (PyIceberg 'credential')",
    )
    parser.add_argument(
        "--oauth2-server-uri",
        default=os.getenv("ICEBERG_OAUTH2_SERVER_URI", ""),
        help="Optional OAuth2 server URI override (PyIceberg 'oauth2-server-uri')",
    )
    parser.add_argument(
        "--header",
        action="append",
        default=[],
        help="Extra HTTP header(s) for REST requests in 'Name: Value' form. Can be repeated.",
    )
    parser.add_argument(
        "--access-delegation",
        default=os.getenv("ICEBERG_ACCESS_DELEGATION", ""),
        help=(
            "Optional value for REST header X-Iceberg-Access-Delegation (e.g. 'vended-credentials'). "
            "If unset, the header is not sent."
        ),
    )
    parser.add_argument(
        "--warehouse",
        default=os.getenv("ICEBERG_WAREHOUSE", ""),
        help=(
            "Optional `warehouse` value for the REST config fetch and table creation. "
            "For standard Iceberg REST this is usually a warehouse location (e.g. s3://bucket/warehouse). "
            "For Gravitino Iceberg REST, this is used to select the backing catalog (catalog name)."
        ),
    )
    parser.add_argument("--namespace", default=os.getenv("ICEBERG_NAMESPACE", "s1"))
    parser.add_argument("--table", default=os.getenv("ICEBERG_TABLE", "student"))
    parser.add_argument(
        "--table-location",
        default=os.getenv("ICEBERG_TABLE_LOCATION", ""),
        help="Optional explicit table location for create-table (e.g. s3://bucket/path). If empty, rely on catalog defaults.",
    )

    parser.add_argument(
        "--fetch-storage-from-gravitino",
        action="store_true",
        help="Fetch S3 storage endpoint/credentials from Gravitino unified API (read-only) when not provided explicitly",
    )
    parser.add_argument("--gravitino-uri", default=os.getenv("GRAVITINO_URI", "http://172.29.119.193:18090"))
    parser.add_argument("--metalake", default=os.getenv("GRAVITINO_METALAKE", "lakehouse_metalake"))
    parser.add_argument(
        "--gravitino-catalog",
        default=os.getenv("GRAVITINO_CATALOG", "iceberg_catalog"),
        help="Gravitino catalog name used only for fetching storage properties",
    )
    parser.add_argument(
        "--sql",
        default=os.getenv("QUERY_SQL", ""),
        help='SQL to execute in DataFusion (default: SELECT * FROM "<table>" LIMIT 10)',
    )
    parser.add_argument("--rows", type=int, default=int(os.getenv("WRITE_ROWS", "100")), help="Rows to write (overwrite)")
    parser.add_argument(
        "--no-write",
        action="store_true",
        help="Do not overwrite data; only scan and run the SQL query",
    )
    parser.add_argument(
        "--create-if-missing",
        action="store_true",
        help="If the table does not exist, create it in the REST catalog",
    )

    parser.add_argument(
        "--list-namespaces",
        action="store_true",
        help="List namespaces via REST catalog and exit (no table required)",
    )
    parser.add_argument(
        "--list-tables",
        nargs="?",
        const="__DEFAULT__",
        default=None,
        help="List tables in a namespace via REST catalog and exit. If no value is provided, uses --namespace.",
    )

    parser.add_argument("--s3-endpoint", default=os.getenv("S3_ENDPOINT", ""), help="S3 endpoint (e.g. http://minio:9000)")
    parser.add_argument("--s3-access-key-id", default=os.getenv("S3_ACCESS_KEY_ID", ""))
    parser.add_argument("--s3-secret-access-key", default=os.getenv("S3_SECRET_ACCESS_KEY", ""))
    parser.add_argument("--s3-region", default=os.getenv("S3_REGION", "us-east-1"))
    parser.add_argument(
        "--s3-force-virtual-addressing",
        default=os.getenv("S3_FORCE_VIRTUAL_ADDRESSING", "false"),
        help="Set true if your S3 requires virtual-hosted style (default: false / path-style)",
    )

    parser.add_argument("--skip-endpoint-check", action="store_true", help="Skip TCP reachability check for S3 endpoint")
    parser.add_argument(
        "--endpoint-check-timeout",
        type=float,
        default=float(os.getenv("ENDPOINT_CHECK_TIMEOUT", "3")),
        help="Timeout seconds for S3 endpoint TCP reachability check",
    )
    args = parser.parse_args()

    # Avoid long stalls on metadata/IMDS in cloud-like envs.
    os.environ.setdefault("AWS_EC2_METADATA_DISABLED", "true")

    print("[1/4] Connecting to Iceberg REST catalog...")
    _preflight_endpoint(args.rest_uri, timeout_s=float(args.endpoint_check_timeout))
    resolved_rest_uri, warehouse_required = resolve_iceberg_rest_uri(args.rest_uri, timeout_s=float(args.rest_uri_timeout))
    if _normalize_http_base_uri(args.rest_uri) != resolved_rest_uri:
        print(f"- Resolved REST base URI: {resolved_rest_uri}")
    if warehouse_required and not args.warehouse:
        raise ValueError(
            "This Iceberg REST endpoint requires a `warehouse` query parameter to select a backing catalog. "
            "Pass it via --warehouse (for Gravitino, set it to the Gravitino catalog name)."
        )

    rest_props: Dict[str, Any] = {"uri": resolved_rest_uri}

    # PyIceberg RestCatalog defaults to a legacy OAuth2 auth adapter and may send
    # `Authorization: Bearer None` when no token/credential is configured.
    # Gravitino Iceberg REST can reject such headers with HTTP 401 even if the
    # service is otherwise open.
    rest_props["auth"] = {"type": args.auth_type}

    # Only send access delegation header when explicitly requested.
    if args.access_delegation:
        rest_props["header.X-Iceberg-Access-Delegation"] = str(args.access_delegation)

    if args.bearer_token:
        rest_props["header.Authorization"] = f"Bearer {args.bearer_token}"
    if args.credential:
        rest_props["credential"] = args.credential
    if args.oauth2_server_uri:
        rest_props["oauth2-server-uri"] = args.oauth2_server_uri

    for raw_header in args.header or []:
        if ":" not in raw_header:
            raise ValueError(f"Invalid --header value (expected 'Name: Value'): {raw_header}")
        name, value = raw_header.split(":", 1)
        name = name.strip()
        value = value.strip()
        if not name:
            raise ValueError(f"Invalid --header value (empty name): {raw_header}")
        rest_props[f"header.{name}"] = value
    if args.warehouse:
        rest_props["warehouse"] = args.warehouse

    # Optionally pull storage (S3/MinIO) config from Gravitino unified API.
    if args.fetch_storage_from_gravitino:
        g_props = fetch_gravitino_catalog_properties(
            gravitino_uri=args.gravitino_uri,
            metalake=args.metalake,
            catalog=args.gravitino_catalog,
            timeout_s=float(args.rest_uri_timeout),
        )
        # Gravitino keys observed in existing scripts: s3-endpoint/s3-access-key-id/s3-secret-access-key/s3-region
        args.s3_endpoint = args.s3_endpoint or g_props.get("s3-endpoint", "")
        args.s3_access_key_id = args.s3_access_key_id or g_props.get("s3-access-key-id", "")
        args.s3_secret_access_key = args.s3_secret_access_key or g_props.get("s3-secret-access-key", "")
        args.s3_region = args.s3_region or g_props.get("s3-region", args.s3_region)
    if args.s3_endpoint:
        rest_props["s3.endpoint"] = args.s3_endpoint
    if args.s3_access_key_id:
        rest_props["s3.access-key-id"] = args.s3_access_key_id
    if args.s3_secret_access_key:
        rest_props["s3.secret-access-key"] = args.s3_secret_access_key
    if args.s3_region:
        rest_props["s3.region"] = args.s3_region
    if args.s3_force_virtual_addressing:
        rest_props["s3.force-virtual-addressing"] = str(args.s3_force_virtual_addressing).lower()

    if args.s3_endpoint and not args.skip_endpoint_check:
        _preflight_endpoint(args.s3_endpoint, timeout_s=args.endpoint_check_timeout)

    from pyiceberg.exceptions import NoSuchTableError

    catalog = create_rest_catalog(args.rest_catalog_name, **rest_props)

    if args.list_namespaces:
        namespaces = catalog.list_namespaces()
        _print_identifiers("Namespaces:", namespaces)
        return 0

    if args.list_tables is not None:
        ns = args.namespace if args.list_tables == "__DEFAULT__" else str(args.list_tables)
        tables = catalog.list_tables(_namespace_tuple(ns))
        _print_identifiers(f"Tables in namespace '{ns}':", tables)
        return 0

    identifier = _table_identifier(args.namespace, args.table)
    print(f"- Table identifier: {'.'.join(identifier[:-1])}.{identifier[-1]}")


    print("[2/4] Loading table from REST catalog...")
    try:
        iceberg_table = catalog.load_table(identifier)
    except NoSuchTableError:
        if not args.create_if_missing:
            raise
        print("- Table not found; creating...")
        ensure_namespace(catalog, args.namespace)
        # Use user-provided location if supplied; otherwise let the catalog decide.
        table_location = args.table_location.strip() or None
        from pyiceberg.schema import Schema
        from pyiceberg.types import NestedField, IntegerType, StringType
        create_schema = Schema(
            NestedField(field_id=1, name="id", field_type=IntegerType(), required=True),
            NestedField(field_id=2, name="name", field_type=StringType(), required=False),
        )
        iceberg_table = catalog.create_table(identifier, schema=create_schema, location=table_location, properties={"format-version": "2"})

    table_location_str = _table_location_str(iceberg_table)
    if table_location_str:
        print(f"- Table location: {table_location_str}")

    # 打印列定义
    print("- Columns (from Iceberg schema):")
    try:
        from tabulate import tabulate
        schema = iceberg_table.schema()
        col_rows = []
        for field in schema.fields:
            col_rows.append([
                field.name,
                str(field.field_type),
                str(not getattr(field, "required", False)).lower(),
                getattr(field, "doc", "") or getattr(field, "comment", "") or ""
            ])
        print(tabulate(col_rows, headers=["name", "type", "nullable", "comment"], tablefmt="grid", showindex=False))
    except Exception:
        schema = iceberg_table.schema()
        for field in schema.fields:
            print(f"  - {field.name}: {field.field_type} nullable={str(not getattr(field, 'required', False)).lower()} comment={getattr(field, 'doc', '') or getattr(field, 'comment', '')}")

    if args.no_write:
        print("[3/4] Skipping overwrite (--no-write)...")
    else:
        if _requires_s3_credentials(table_location_str):
            # If the table is S3-backed and we didn't get credentials from any source,
            # fail fast with an actionable message.
            has_cli_keys = bool(args.s3_access_key_id and args.s3_secret_access_key)
            if not has_cli_keys and not _has_env_s3_credentials():
                endpoint_hint = args.s3_endpoint or "(from REST config: likely http://172.29.119.193:29000)"
                raise RuntimeError(
                    "Table location is S3-backed but no credentials were provided. "
                    "Provide S3/MinIO credentials via --s3-access-key-id/--s3-secret-access-key "
                    "(and optionally --s3-endpoint), or set AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY in the environment. "
                    f"Endpoint hint: {endpoint_hint}"
                )

        print("[3/4] Overwriting data through Iceberg REST catalog...")
        arrow_write_table = generate_random_arrow_table_from_iceberg_schema(iceberg_table.schema(), num_rows=args.rows)
        iceberg_table.overwrite(arrow_write_table)
        print(f"- Overwrote {args.rows} rows")

    print("[4/4] Scanning Iceberg with PyIceberg -> querying with DataFusion SQL...")
    arrow_scan_table = iceberg_table.scan().to_arrow()

    safe_table = args.table.replace('"', '""')
    sql = args.sql.strip() or f'SELECT * FROM "{safe_table}" LIMIT 10'
    result_table = query_with_datafusion_from_arrow(args.table, arrow_scan_table, sql)

    print(f"- SQL: {sql}")
    print("- Result (table format):")
    print_arrow_table_as_sql_result(result_table)

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        raise
