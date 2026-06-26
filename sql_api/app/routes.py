"""
Routes for Iceberg and Lance SQL queries.
"""

from typing import Dict, Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from .query_iceberg import (
    fetch_gravitino_catalog_properties,
    resolve_iceberg_rest_uri,
    create_rest_catalog,
    _table_identifier,
    query_with_datafusion_from_arrow,
    _preflight_endpoint,
)
from .query_lance import (
    GravitinoTableRef,
    fetch_gravitino_table,
    parse_lance_properties,
    extract_gravitino_columns,
    build_lance_storage_options_from_props,
    _preflight_s3_endpoint,
    query_with_datafusion as query_with_datafusion_lance,
)

router = APIRouter()


class IcebergQueryParams(BaseModel):
    rest_uri: str = Field(..., description="Iceberg REST catalog base URI")
    warehouse: str = Field(..., description="Warehouse name")
    namespace: str = Field(..., description="Namespace name")
    table: str = Field(..., description="Table name")
    sql: str = Field(..., description="SQL query to execute")
    bearer_token: Optional[str] = Field(None, description="Bearer token for authentication")
    auth_type: str = Field("noop", description="Authentication type")
    credential: Optional[str] = Field(None, description="OAuth2 credential")
    oauth2_server_uri: Optional[str] = Field(None, description="OAuth2 server URI")
    access_delegation: Optional[str] = Field(None, description="Access delegation setting")
    gravitino_uri: Optional[str] = Field(None, description="Gravitino URI for storage properties")
    metalake: Optional[str] = Field(None, description="Gravitino metalake name")
    gravitino_catalog: Optional[str] = Field(None, description="Gravitino catalog name for storage properties")
    s3_endpoint: Optional[str] = Field(None, description="S3 endpoint")
    s3_access_key_id: Optional[str] = Field(None, description="S3 access key ID")
    s3_secret_access_key: Optional[str] = Field(None, description="S3 secret access key")
    s3_region: str = Field("us-east-1", description="S3 region")
    fetch_storage_from_gravitino: bool = Field(False, description="Fetch S3 storage properties from Gravitino")
    skip_endpoint_check: bool = Field(False, description="Skip endpoint connectivity check")
    endpoint_check_timeout: float = Field(3.0, description="Endpoint check timeout in seconds", ge=0)


class LanceQueryParams(BaseModel):
    gravitino_uri: str = Field(..., description="Gravitino unified API base URI")
    metalake: str = Field(..., description="Gravitino metalake name")
    catalog: str = Field(..., description="Gravitino catalog name")
    namespace: str = Field(..., description="Namespace name")
    table: str = Field(..., description="Table name")
    sql: str = Field(..., description="SQL to execute in DataFusion")
    skip_endpoint_check: bool = Field(False, description="Skip endpoint connectivity check")
    endpoint_check_timeout: float = Field(3.0, description="Endpoint check timeout in seconds", ge=0)


@router.get("/")
async def root():
    return {"message": "Welcome to AI Query Service"}


@router.post("/query/iceberg")
async def query_iceberg(params: IcebergQueryParams):
    """Query an Iceberg table via Iceberg REST catalog and DataFusion SQL"""
    print(f"params: {params}")
    try:
        # Resolve REST URI
        resolved_rest_uri, warehouse_required = resolve_iceberg_rest_uri(
            params.rest_uri, timeout_s=params.endpoint_check_timeout
        )

        if warehouse_required and not params.warehouse:
            raise HTTPException(
                status_code=400, detail="This Iceberg REST endpoint requires a warehouse parameter"
            )

        if not params.skip_endpoint_check:
            _preflight_endpoint(params.rest_uri, timeout_s=params.endpoint_check_timeout)

        # Build REST properties
        rest_props: Dict[str, Any] = {"uri": resolved_rest_uri}
        rest_props["auth"] = {"type": params.auth_type}

        if params.access_delegation:
            rest_props["header.X-Iceberg-Access-Delegation"] = str(params.access_delegation)
        if params.bearer_token:
            rest_props["header.Authorization"] = f"Bearer {params.bearer_token}"
        if params.credential:
            rest_props["credential"] = params.credential
        if params.oauth2_server_uri:
            rest_props["oauth2-server-uri"] = params.oauth2_server_uri
        if params.warehouse:
            rest_props["warehouse"] = params.warehouse

        # Fetch storage properties from Gravitino if requested
        s3_endpoint = params.s3_endpoint
        s3_access_key_id = params.s3_access_key_id
        s3_secret_access_key = params.s3_secret_access_key
        s3_region = params.s3_region

        if params.fetch_storage_from_gravitino and params.gravitino_uri and params.metalake and params.gravitino_catalog:
            g_props = fetch_gravitino_catalog_properties(
                gravitino_uri=params.gravitino_uri,
                metalake=params.metalake,
                catalog=params.gravitino_catalog,
                timeout_s=params.endpoint_check_timeout,
            )
            s3_endpoint = s3_endpoint or g_props.get("s3-endpoint", "")
            s3_access_key_id = s3_access_key_id or g_props.get("s3-access-key-id", "")
            s3_secret_access_key = s3_secret_access_key or g_props.get("s3-secret-access-key", "")
            s3_region = g_props.get("s3-region", s3_region)

        if s3_endpoint:
            rest_props["s3.endpoint"] = s3_endpoint
        if s3_access_key_id:
            rest_props["s3.access-key-id"] = s3_access_key_id
        if s3_secret_access_key:
            rest_props["s3.secret-access-key"] = s3_secret_access_key
        if s3_region:
            rest_props["s3.region"] = s3_region

        # Create catalog and query
        catalog = create_rest_catalog("rest_catalog", **rest_props)
        identifier = _table_identifier(params.namespace, params.table)
        iceberg_table = catalog.load_table(identifier)

        arrow_scan_table = iceberg_table.scan().to_arrow()
        safe_table = params.table.replace('"', '""')
        result_table = query_with_datafusion_from_arrow(params.table, arrow_scan_table, params.sql)

        result_dict = result_table.to_pydict()
        return {
            "status": "success",
            "query": params.sql,
            "result": result_dict,
            "row_count": result_table.num_rows,
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error executing Iceberg query: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error executing Iceberg query: {str(e)}")


@router.post("/query/lance")
async def query_lance(params: LanceQueryParams):
    """Query a Lance table via Gravitino unified API and DataFusion SQL"""
    print(f"params: {params}")
    try:
        # Create table reference
        ref = GravitinoTableRef(
            uri=params.gravitino_uri,
            metalake=params.metalake,
            catalog=params.catalog,
            schema=params.namespace,
            table=params.table,
        )

        # Fetch table metadata from Gravitino
        table_obj = fetch_gravitino_table(ref)
        columns = extract_gravitino_columns(table_obj)
        location, props = parse_lance_properties(table_obj)
        storage_options = build_lance_storage_options_from_props(props)

        if not params.skip_endpoint_check:
            _preflight_s3_endpoint(storage_options, timeout_s=params.endpoint_check_timeout)

        # Execute query
        safe_table = params.table.replace('"', '""')
        sql_to_run = params.sql or f'SELECT * FROM "{safe_table}" LIMIT 10'
        sql_result, result_table = query_with_datafusion_lance(
            location, storage_options, params.table, sql=sql_to_run
        )

        result_dict = result_table.to_pydict()
        return {
            "status": "success",
            "query": sql_result,
            "result": result_dict,
            "row_count": result_table.num_rows,
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error executing Lance query: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error executing Lance query: {str(e)}")
